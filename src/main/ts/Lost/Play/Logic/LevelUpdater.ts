interface LevelUpdater {
    updateLevel(): LevelUpdate;
    queueInput(input: Input): void;
    getEffectiveResourceCounts(entity: Entity): { [_: number]: number };
    getEffectiveHealth(entity: Entity): number;
}

type PlayDiceFailureReason = number;
let PLAY_DICE_FAILURE_REASON_BLOCKED = 1;
let PLAY_DICE_FAILURE_REASON_NOT_YOUR_DICE = 2;
let PLAY_DICE_FAILURE_REASON_NO_ROOM = 3;
let PLAY_DICE_FAILURE_REASON_NO_RESOURCES = 4;

interface CanPlayDiceResult {
    dice?: Dice;
    fromDiceSlot?: number;
    toTileX: number;
    toTileY: number;
    toTilePosition?: string;
    failureReason?: PlayDiceFailureReason,
    resourcesUsed?: { [_: number]: number }
}

type CollectDiceFailureReason = number;
let COLLECT_DICE_FAILURE_REASON_NOT_FOUND = 1;
let COLLECT_DICE_FAILURE_REASON_NO_ROOM = 2;
let COLLECT_DICE_FAILURE_REASON_NOT_YOUR_DICE = 3;
let COLLECT_DICE_FAILURE_REASON_TOO_FAR = 4;
let COLLECT_DICE_FAILURE_REASON_NO_RESOURCES = 5;
let COLLECT_DICE_FAILURE_REASON_DEAD = 6;

interface CanCollectDiceResult {
    dice?: Dice;
    toEntity?: Entity;
    toDiceSlot?: number;
    fromTileX?: number;
    fromTileY?: number;
    fromTilePosition?: string;
    fromFace?: DiceFace;
    failureReason?: CollectDiceFailureReason;
    resourceEntity?: Entity;
    resourceDeltas?: { [_: number]: number };
}

interface DiceAndWeight {
    dice: Dice,
    diceWeight: number,
    offensive: boolean,
    collect?: boolean
}

function createLevelUpdater(game: Game, level: Level): LevelUpdater {

    let entitiesInOrder: Entity[] = [];
    let currentTurnEntityIndex = 0;
    let inputQueue: Input[] = [];
    let waitingOnInput: boolean;
    

    // add the entities in order (of side)
    levelFindTile(level, function (tile) {
        if (tile.entity) {
            arrayPush(entitiesInOrder, tile.entity);
        }
    });

    function sortEntitiesInOrder() {
        entitiesInOrder.sort(function (a: Entity, b: Entity) {
            return a.id - b.id;
        })
    }

    function getRollCost(entity: Entity, resourceType: ResourceType, resourceQuantity: number, resourcesUsed: { [_: number]: number }): boolean {
        let effectiveResourceCounts = levelUpdater.getEffectiveResourceCounts(entity);
        let acceptableResourceTypes: ResourceType[] = [resourceType];
        if (!resourceType) {
            acceptableResourceTypes = RESOURCE_TYPE_ALL;
        }
        arrayForEach(acceptableResourceTypes, function (acceptableResourceType: ResourceType) {
            let effectiveResourceCount = effectiveResourceCounts[acceptableResourceType];
            let resourceUsed = max(0, min(effectiveResourceCount, resourceQuantity));
            resourcesUsed[acceptableResourceType] -= resourceUsed;
            resourceQuantity -= resourceUsed;
        });
        return resourceQuantity > 0;
    }

    function turnToOrientation(entity: Entity, orientation: Orientation): ActionResult {
        let oldOrientation = entity.entityOrientation;
        entity.entityOrientation = orientation;
        return {
            deltas: [{
                deltaType: LEVEL_DELTA_TYPE_TURN,
                deltaData: {
                    entity: entity,
                    fromOrientation: oldOrientation,
                    toOrientation: orientation
                }
            }]
        };
    }

    function moveForward(entity: Entity): ActionResult {
        let orientation = entity.entityOrientation;
        let dpos = ORIENTATION_DIFFS[orientation];

        let pos = levelGetPosition(level, entity);
        let x = pos.x + dpos.x;
        let y = pos.y + dpos.y;
        let valid = x >= 0 && y >= 0 && x < level.levelWidth && y < level.levelHeight;
        let deltaType: LevelDeltaType = LEVEL_DELTA_TYPE_MOVE_INVALID;
        let moveData: LevelDeltaDataMove = {
            moveDirection: orientation,
            fromX: pos.x,
            fromY: pos.y,
            entity: entity
        };
        let deltas: LevelDelta[];
        if (valid) {
            let targetTile = level.tiles[x][y];
            valid = targetTile.tileType != TILE_TYPE_SOLID && !targetTile.entity;
            if (valid) {
                // move the entity
                let sourceTile = level.tiles[pos.x][pos.y];
                let previousHealth = getEffectiveHealth(entity, pos.x, pos.y);
                sourceTile.entity = nil;
                targetTile.entity = entity;
                // update the deltas

                // TODO negate old resource map
                let oldResourceCounts = entity.resourceCounts;
                entity.resourceCounts = zeroResourceMap();
                let resourceDelta: LevelDeltaDataResourceChange = {
                    entity: entity,
                    resourceDeltas: oldResourceCounts,
                    newEffectiveResourceCounts: levelUpdater.getEffectiveResourceCounts(entity)
                };

                // did we move onto a pit?
                let children: LevelDelta[];
                if (targetTile.tileType == TILE_TYPE_PIT) {
                    let fallChildren: LevelDelta[] = [{
                        deltaType: LEVEL_DELTA_TYPE_DIE,
                        deltaData: {
                            entity: entity
                        }
                    }];
                    if (entity.behaviorType == BEHAVIOR_TYPE_PLAYER) {
                        arrayPush(
                            fallChildren,
                            {
                                deltaType: LEVEL_DELTA_TYPE_CHANGE_STATE,
                                deltaData: {
                                    stateTypeId: STATE_TYPE_PLAY,
                                    stateData: {
                                        game: game,
                                        playerTransition: {
                                            entity: entity,
                                            entryLocation: {
                                                levelId: game.nextLevelId,
                                                tileName: targetTile.tileName
                                            }
                                        }

                                    }
                                }
                            }
                        );
                    } 
                    children = [
                        {
                            deltaType: LEVEL_DELTA_TYPE_FALL,
                            deltaData: {
                                entity: entity,
                                tileX: pos.x,
                                tileY: pos.y
                            },
                            deltaChildren: fallChildren
                        }
                    ]
                } else {
                    children = applyAmbientEffects(entity, previousHealth);
                }

                // interact with any feature on the new tile
                if (targetTile.featureType) {

                    // interact with it
                    let featureChildren: LevelDelta[];
                    switch (targetTile.featureType) {
                        case FEATURE_TYPE_BONUS_DICE_SLOT:
                            entity.diceSlots++;
                            featureChildren = [
                                {
                                    deltaType: LEVEL_DELTA_TYPE_DICE_SLOTS_CHANGE,
                                    deltaData: <LevelDeltaDataDiceSlotsChange>{
                                        diceSlotDelta: 1,
                                        diceSlots: entity.diceSlots
                                    }
                                }
                            ];
                            break;
                        case FEATURE_TYPE_BONUS_HEALTH:
                            entity.healthSlots++;
                            featureChildren = [
                                {
                                    deltaType: LEVEL_DELTA_TYPE_HEALTH_CHANGE,
                                    deltaData: <LevelDeltaDataHealthChange>{
                                        deltaHealth: 1,
                                        totalHealth: entity.healthSlots,
                                        entity: entity
                                    }
                                }
                            ];
                            break;
                    }
                    targetTile.featureType = FEATURE_TYPE_NONE;
                    arrayPushAll(featureChildren, children);
                    children = [
                        {
                            deltaType: LEVEL_DELTA_TYPE_CONSUME_FEATURE,
                            deltaData: <LevelDeltaDataConsumeFeature>{
                                entity: entity,
                                featureTile: targetTile,
                                fromTileX: x,
                                fromTileY: y
                            },
                            deltaChildren: featureChildren
                        }
                    ];
                }



                deltas = [{
                    deltaType: LEVEL_DELTA_TYPE_MOVE,
                    deltaData: moveData,
                    deltaChildren: children
                }, {
                    deltaType: LEVEL_DELTA_TYPE_RESOURCE_CHANGE,
                    deltaData: resourceDelta
                }]
            }
        }
        if (!valid) {
            deltas = [{
                deltaType: LEVEL_DELTA_TYPE_MOVE_INVALID,
                deltaData: moveData
            }];
        }

        return {
            moveToNext: valid,
            deltas: deltas
        }
    }

    function getEffectiveHealth(entity: Entity, tx: number, ty: number): number {
        if (entity) {
            let health = entity.healthSlots;
            let tile = level.tiles[tx][ty];
            mapForEach(tile.dice, function (key: string, diceAndFace: DiceAndFace) {
                if (diceAndFace) {
                    let symbols = diceAndFace.dice.symbols[diceAndFace.upturnedFace];
                    arrayForEach(symbols, function (symbol: DiceSymbol) {
                        if (symbol == DICE_SYMBOL_ATTACK) {
                            health--;
                        } else if (symbol == DICE_SYMBOL_DEFEND) {
                            health++;
                        }
                    });
                }
            });
            return max(0, min(health, entity.healthSlots));
        }
    }

    function applyAmbientEffects(entity: Entity, currentHealth: number): LevelDelta[] {
        // check health
        let result: LevelDelta[] = [];
        if (!entity.dead) {
            let entityPos = levelGetPosition(level, entity);
            let newHealth = getEffectiveHealth(entity, entityPos.x, entityPos.y);
            let delta = newHealth - currentHealth;
            if (delta || !newHealth) {
                let children: LevelDelta[];
                entity.dead = !newHealth;
                if (entity.dead) {
                    let tile = level.tiles[entityPos.x][entityPos.y];
                    children = [
                        {
                            deltaType: LEVEL_DELTA_TYPE_DIE,
                            deltaData: <LevelDeltaDataDie>{
                                entity: entity
                            }
                        }
                    ];
                    // drop all the dice

                    arrayForEach(entity.dice, function (dice: Dice) {
                        if (dice) {
                            let canPlayDiceResult = canPlayDice(entity, dice.diceId, <any>1, <any>1);
                            if (!canPlayDiceResult.failureReason) {
                                let actionResult = playDice(entity, canPlayDiceResult);
                                if (actionResult && actionResult.deltas) {
                                    arrayPushAll(result, actionResult.deltas);
                                }
                            }
                        }
                    });

                    tile.entity = nil;
                }
                arrayPush(
                    result,
                    {
                        deltaType: LEVEL_DELTA_TYPE_HEALTH_CHANGE,
                        deltaData: <LevelDeltaDataHealthChange>{
                            entity: entity,
                            deltaHealth: delta,
                            totalHealth: newHealth,
                        },
                        deltaChildren: children
                    }
                );
            }
        }
        return result;
    }

    function look(entity: Entity, down?: boolean): ActionResult {
        let deltas: LevelDelta[];
        if (entity.lookingDown != down) {
            entity.lookingDown = down;
            deltas = [{
                deltaType: down ? LEVEL_DELTA_TYPE_LOOK_DOWN : LEVEL_DELTA_TYPE_LOOK_UP,
                deltaData: {
                    entity: entity
                }
            }]            
        }
        return {  
            deltas: deltas
        };

    }

    function canCollectDice(entity: Entity, data: InputDataCollectDice): CanCollectDiceResult {
        let entityPos = levelGetPosition(level, entity);
        let failureReason: CollectDiceFailureReason;
        let result: CanCollectDiceResult;
        if (entityPos) {
            let diff = abs(entityPos.x - data.tileX) + abs(entityPos.y - data.tileY);
            let fromTile = level.tiles[data.tileX][data.tileY];
            let diceAndFace = fromTile.dice[data.dicePosition];
            if (diff <= 1) {
                if (diceAndFace && diceAndFace.dice.diceId == data.diceId) {

                    let toEntity = entity;
                    // attempt to find the entity who owns the die
                    if (fromTile.entity && diceAndFace.dice.owner != entity.id) {
                        // if there is no entity in the tile, the dice is effectively ours
                        // assume it's theirs
                        toEntity = fromTile.entity;
                        levelFindTile(level, function (tile: Tile, x: number, y: number) {
                            if (tile.entity && tile.entity.id == diceAndFace.dice.owner) {
                                let diff = abs(x - data.tileX) + abs(y - data.tileY);
                                if (diff <= 1) {
                                    // unless the owner is adjacent to them
                                    toEntity = tile.entity;
                                }
                            }
                        });
                    }

                    // ensure we have the entire array at our disposal
                    while (toEntity.dice.length < toEntity.diceSlots) {
                        arrayPush(toEntity.dice, nil);
                    }

                    let targetSlot: number;
                    arrayForEach(toEntity.dice, function (dice: Dice, index: number) {
                        if (targetSlot == nil && !dice) {
                            targetSlot = index;
                        }
                    });

                    if (targetSlot != nil) {
                        let resourceValueDeltas: { [_: number]: number } = zeroResourceMap();

                        if (!diff) {
                            arrayForEach(diceAndFace.dice.symbols[diceAndFace.upturnedFace], function (symbol: DiceSymbol) {
                                let symbolResourceValues = DICE_SYMBOL_RESOURCE_VALUES[symbol];
                                mapForEach(symbolResourceValues, function (resourceType: string, value: number) {
                                    if (value > 0) {
                                        resourceValueDeltas[resourceType] += value;
                                    }
                                });
                            });
                        }
                        if (toEntity != entity) {
                            // it's not our die, so it costs us to unroll it!
                            if (!diff) {
                                let failed = getRollCost(entity, diceAndFace.dice.diceType, diceAndFace.dice.diceLevel + 1, resourceValueDeltas);
                                if (failed) {
                                    failureReason = COLLECT_DICE_FAILURE_REASON_NO_RESOURCES;
                                }
                            } else {
                                failureReason = COLLECT_DICE_FAILURE_REASON_TOO_FAR;
                            }
                        }
                        result = {
                            dice: diceAndFace.dice,
                            fromFace: diceAndFace.upturnedFace,
                            fromTilePosition: data.dicePosition,
                            fromTileX: data.tileX,
                            fromTileY: data.tileY,
                            resourceDeltas: resourceValueDeltas,
                            resourceEntity: entity,
                            toEntity: toEntity,
                            toDiceSlot: targetSlot
                        };
                    } else {
                        failureReason = COLLECT_DICE_FAILURE_REASON_NO_ROOM;
                    }

                } else {
                    failureReason = COLLECT_DICE_FAILURE_REASON_NOT_FOUND;
                }
            } else {
                failureReason = COLLECT_DICE_FAILURE_REASON_TOO_FAR;
            }
        } else {
            failureReason = COLLECT_DICE_FAILURE_REASON_DEAD;
        }
        if (!result) {
            result = {};
        }
        result.failureReason = failureReason;
        return result;
    }

    function collectDice(entity: Entity, canCollectDiceResult: CanCollectDiceResult): ActionResult {
        
        let deltas: LevelDelta[];
        if (!canCollectDiceResult.failureReason) {


            let fromTile = level.tiles[canCollectDiceResult.fromTileX][canCollectDiceResult.fromTileY];

            let previousHealth = getEffectiveHealth(fromTile.entity, canCollectDiceResult.fromTileX, canCollectDiceResult.fromTileY);

            fromTile.dice[canCollectDiceResult.fromTilePosition] = nil;
            canCollectDiceResult.toEntity.dice[canCollectDiceResult.toDiceSlot] = canCollectDiceResult.dice;
            canCollectDiceResult.dice.owner = canCollectDiceResult.toEntity.id;

            // subtract resources from resource entity
            mapForEach(canCollectDiceResult.resourceDeltas, function (resourceType: string, value: number) {
                canCollectDiceResult.resourceEntity.resourceCounts[resourceType] += value;
            });
            let children: LevelDelta[];
            if (fromTile.entity) {
                children = applyAmbientEffects(
                    fromTile.entity,
                    previousHealth
                );
            }

            deltas = [
                {
                    deltaType: LEVEL_DELTA_TYPE_COLLECT_DICE,
                    deltaData: <LevelDeltaDataCollectDice>{
                        entity: canCollectDiceResult.toEntity,
                        dice: canCollectDiceResult.dice,
                        toDiceSlot: canCollectDiceResult.toDiceSlot,
                        fromTileX: canCollectDiceResult.fromTileX,
                        fromTileY: canCollectDiceResult.fromTileY,
                        fromTilePosition: canCollectDiceResult.fromTilePosition,
                        fromFace: canCollectDiceResult.fromFace
                    },
                    deltaChildren: [
                        {
                            deltaType: LEVEL_DELTA_TYPE_RESOURCE_CHANGE,
                            deltaData: <LevelDeltaDataResourceChange>{
                                entity: canCollectDiceResult.resourceEntity,
                                resourceDeltas: canCollectDiceResult.resourceDeltas,
                                newEffectiveResourceCounts: levelUpdater.getEffectiveResourceCounts(canCollectDiceResult.resourceEntity)
                            },
                            deltaChildren: children
                        }
                    ]
                }
            ];

        }
        return {
            deltas: deltas
        }
    }

    function canPlayDice(entity: Entity, diceId: DiceId, lookingDown: boolean, dropping?: boolean): CanPlayDiceResult {
        let entityPos = levelGetPosition(level, entity);
        let toTileX: number;
        let toTileY: number;
        let targetOrientation: Orientation;
        let slots: { [_: number]: TileSlot };
        if (lookingDown) {
            // play to current tile
            toTileX = entityPos.x;
            toTileY = entityPos.y;
            targetOrientation = entity.entityOrientation;
            slots = TILE_SLOTS_DEFENSIVE;
        } else {
            // play to oriented tile
            let delta = ORIENTATION_DIFFS[entity.entityOrientation];
            toTileX = entityPos.x + delta.x;
            toTileY = entityPos.y + delta.y;
            targetOrientation = (entity.entityOrientation + 2) % 4;
            slots = TILE_SLOTS_OFFENSIVE;
        }
        let result: CanPlayDiceResult = {
            toTileX: toTileX,
            toTileY: toTileY
        };
        let failureReason: PlayDiceFailureReason;
        if (toTileX >= 0 && toTileY >= 0 && toTileX < level.levelWidth && toTileY < level.levelHeight) {
            // find a free slot on the tile that best matches our target orientation
            let tile = level.tiles[toTileX][toTileY];
            if (dropping || !tile.entity) {
                // put it anywhere
                slots = TILE_SLOTS_ALL;
            }

            if (tile.tileType != TILE_TYPE_SOLID) {
                let targetDiff = ORIENTATION_DIFFS[targetOrientation];
                let targetX = targetDiff.x;
                let targetY = targetDiff.y;
                if (dropping && FEATURE_DROP_RANDOM_POSITIONS_ON_DEATH) {
                    targetX = random() - .5;
                    targetY = random() - .5;                   
                }
                let targetSlotKey = getBestAvailableTileSlotKey(slots, tile, targetX, targetY);
                if (targetSlotKey != nil) {
                    result.toTilePosition = targetSlotKey;
                    arrayForEachReverse(entity.dice, function (dice: Dice, index: number) {
                        if (dice && dice.diceId == diceId) {
                            result.dice = dice;
                            result.fromDiceSlot = index;
                        }
                    });
                    if (result.dice) {
                        if (tile.entity && !dropping) {
                            // we need to check we we can affort to play the dice (you can throw whatever you want into unoccupied tiles)
                            let resourcesUsed: { [_: number]: number } = zeroResourceMap();
                            let failed = getRollCost(entity, result.dice.diceType, result.dice.diceLevel, resourcesUsed);
                            if (failed) {
                                failureReason = PLAY_DICE_FAILURE_REASON_NO_RESOURCES;
                            }
                            result.resourcesUsed = resourcesUsed;
                        }
                    } else {
                        failureReason = PLAY_DICE_FAILURE_REASON_NOT_YOUR_DICE;
                    }
                } else {
                    failureReason = PLAY_DICE_FAILURE_REASON_NO_ROOM;
                }
            } else {
                failureReason = PLAY_DICE_FAILURE_REASON_BLOCKED;
            }
        }
        result.failureReason = failureReason;
        return result;
    }

    function playDice(entity: Entity, canPlayDiceResult: CanPlayDiceResult): ActionResult {
        let diceId = canPlayDiceResult.dice.diceId;

        let deltas: LevelDelta[];
        let success = !canPlayDiceResult.failureReason;
        if (success) {
            let face = floor(random() * 6);
            let tile = level.tiles[canPlayDiceResult.toTileX][canPlayDiceResult.toTileY];
            let previousHealth = getEffectiveHealth(tile.entity, canPlayDiceResult.toTileX, canPlayDiceResult.toTileY);
            tile.dice[canPlayDiceResult.toTilePosition] = {
                dice: canPlayDiceResult.dice,
                upturnedFace: face
            };
            // TODO if we are throwing it into a pit, kill the dice on landing
            entity.dice[canPlayDiceResult.fromDiceSlot] = nil;

            let ambientEffects: LevelDelta[];
            let targetEntity = tile.entity;
            if (targetEntity) {
                ambientEffects = applyAmbientEffects(targetEntity, previousHealth);
            }
            let playDelta: LevelDelta = {
                deltaType: LEVEL_DELTA_TYPE_PLAY_DICE,
                deltaData: {
                    entity: entity,
                    dice: canPlayDiceResult.dice,
                    fromDiceSlot: canPlayDiceResult.fromDiceSlot,
                    toFace: face,
                    toTileX: canPlayDiceResult.toTileX,
                    toTileY: canPlayDiceResult.toTileY,
                    toTilePosition: canPlayDiceResult.toTilePosition
                },
                deltaChildren: ambientEffects
            };

            if (canPlayDiceResult.resourcesUsed) {
                
                let resourcesUsed = canPlayDiceResult.resourcesUsed;
                mapForEach(resourcesUsed, function (resourceType: string, amount: number) {
                    entity.resourceCounts[resourceType] += amount;
                });
                // push delta for resource count change
                deltas = [
                    {
                        deltaType: LEVEL_DELTA_TYPE_RESOURCE_CHANGE,
                        deltaData: <LevelDeltaDataResourceChange>{
                            entity: entity,
                            newEffectiveResourceCounts: levelUpdater.getEffectiveResourceCounts(entity),
                            resourceDeltas: resourcesUsed
                        },
                        deltaChildren: [playDelta]
                    }
                ];
            } else {
                deltas = [playDelta];
            }

            let reverseOrientation = (entity.entityOrientation + 2) % 4;
            if (targetEntity && targetEntity != entity && FEATURE_LOOK_AT_ATTACKER) {
                if (targetEntity.entityOrientation != reverseOrientation) {
                    // make the entity look
                    let turnAction = turnToOrientation(targetEntity, reverseOrientation);
                    turnAction.deltas[0].deltaChildren = deltas;
                    deltas = turnAction.deltas;
                }
                if (targetEntity.lookingDown) {
                    let lookAction = look(targetEntity);
                    lookAction.deltas[0].deltaChildren = deltas;
                    deltas = lookAction.deltas;
                }
            }
            
        }
        return {
            moveToNext: success,
            deltas: deltas
        }
        
    }

    let levelUpdater: LevelUpdater = {
        updateLevel: function (): LevelUpdate {
            let deltas: LevelDelta[];
            if (entitiesInOrder.length) {
                let entity = entitiesInOrder[currentTurnEntityIndex];
                let action: ActionResult;
                if (entity.dead) {
                    arraySplice(entitiesInOrder, currentTurnEntityIndex, 1);
                    currentTurnEntityIndex = currentTurnEntityIndex % entitiesInOrder.length;
                } else {
                    let moveToNext: boolean;
                    if (entity.behaviorType == BEHAVIOR_TYPE_PLAYER) {
                        waitingOnInput = inputQueue.length == 0;
                        if (!waitingOnInput) {
                            let input = arraySplice(inputQueue, 0, 1)[0];
                            switch (input.inputTypeId) {
                                case INPUT_TYPE_LOOK_DOWN:
                                    action = look(entity, <any>1);
                                    break;
                                case INPUT_TYPE_MOVE_FORWARD:
                                    if (entity.lookingDown) {
                                        action = look(entity);
                                    } else {
                                        action = moveForward(entity);
                                    }
                                    break;
                                case INPUT_TYPE_TURN:
                                    {
                                        let orientation = entity.entityOrientation;
                                        let inputDataTurn = <InputDataTurn>input.inputData;
                                        if (inputDataTurn.fromOrientationHint != nil) {
                                            orientation = inputDataTurn.fromOrientationHint;
                                        }
                                        orientation += inputDataTurn.orientationDelta;
                                        while (orientation < ORIENTATION_NORTH) {
                                            orientation += 4;
                                        }
                                        orientation = orientation % 4;
                                        action = turnToOrientation(entity, orientation);
                                    }
                                    break;
                                case INPUT_TYPE_COLLECT_DICE:
                                    action = collectDice(entity, canCollectDice(entity, <InputDataCollectDice>input.inputData));
                                    break;
                                case INPUT_TYPE_PLAY_DICE:
                                    action = playDice(entity, canPlayDice(entity, (<InputDataPlayDice>input.inputData).diceId, entity.lookingDown));
                                    break;
                            }
                        }
                    } else {
                        // do some AI stuff
                        // always face the player if they are adjacent
                        let pos = levelGetPosition(level, entity);
                        moveToNext = <any>1;
                        // we want to maintain a free slot so we can pick up any cheesy dice the player is throwing our way
                        let diceCount = 0;
                        arrayForEach(entity.dice, function (dice: Dice) {
                            if (dice) {
                                diceCount++;
                            }
                        });
                        arrayForEach(ORIENTATION_DIFFS, function (diff: Point, orientation: Orientation) {
                            let x = pos.x + diff.x;
                            let y = pos.y + diff.y;
                            if (x >= 0 && y >= 0 && x < level.levelWidth && y < level.levelHeight) {
                                let tile = level.tiles[x][y];
                                if (tile.entity || diceCount == entity.diceSlots) {
                                    if (!tile.entity || tile.entity.behaviorType == BEHAVIOR_TYPE_PLAYER) {
                                        if (tile.entity && orientation != entity.entityOrientation) {
                                            action = turnToOrientation(entity, orientation);
                                        } else {

                                            let weightedDice: DiceAndWeight[] = [];
                                            arrayForEach(
                                                entity.dice,
                                                function (dice: Dice) {
                                                    if (dice) {
                                                        let weight = 0;
                                                        let offensiveness = 0;
                                                        arrayForEach(dice.symbols, function (symbols: DiceSymbol[]) {
                                                            arrayForEach(symbols, function (symbol: DiceSymbol) {
                                                                let symbolWeight = entity.personality.playDiceSymbolWeights[symbol];
                                                                if (symbolWeight) {
                                                                    weight += symbolWeight;
                                                                }
                                                                let symbolOffensiveness = DICE_SYMBOL_OFFENSIVENESS[symbol];
                                                                offensiveness += symbolOffensiveness;
                                                            });
                                                        });
                                                        arrayPush(
                                                            weightedDice,
                                                            <DiceAndWeight>{
                                                                dice: dice,
                                                                diceWeight: weight,
                                                                offensive: offensiveness > 0
                                                            }
                                                        );
                                                    }
                                                }
                                            );

                                            let availableDice: DiceAndFace[] = [];
                                            let myTile = level.tiles[pos.x][pos.y];
                                            let inputs: { [_: number]: InputDataCollectDice } = {};
                                            mapForEach(myTile.dice, function (position: string, diceAndFace: DiceAndFace) {
                                                if (diceAndFace) {
                                                    arrayPush(availableDice, diceAndFace);
                                                    inputs[diceAndFace.dice.diceId] = {
                                                        diceId: diceAndFace.dice.diceId,
                                                        tileX: pos.x,
                                                        tileY: pos.y,
                                                        dicePosition: position
                                                    }
                                                }
                                            });
                                            mapForEach(tile.dice, function (position: string, diceAndFace: DiceAndFace) {
                                                if (diceAndFace) {
                                                    arrayPush(availableDice, diceAndFace);
                                                    inputs[diceAndFace.dice.diceId] = {
                                                        diceId: diceAndFace.dice.diceId,
                                                        tileX: x,
                                                        tileY: y,
                                                        dicePosition: position
                                                    };
                                                }
                                            });
                                            arrayForEach(
                                                availableDice,
                                                function (diceAndFace: DiceAndFace) {
                                                    // adjust the weight based on the unrealized potential, invert for enemy dice
                                                    let currentValue = 0;
                                                    let otherValue = 0;
                                                    let dice = diceAndFace.dice;
                                                    let offensiveness = 0;
                                                    let collectBonus = 0;
                                                    let isResourceDice: boolean = <any>1;
                                                    arrayForEach(dice.symbols, function (symbols: DiceSymbol[], side: number) {
                                                        arrayForEach(symbols, function (symbol: DiceSymbol) {
                                                            let symbolWeight = entity.personality.playDiceSymbolWeights[symbol]
                                                            isResourceDice = isResourceDice && isSymbolResource(symbol);
                                                            if (side == diceAndFace.upturnedFace) {
                                                                currentValue += symbolWeight;
                                                                collectBonus += entity.personality.collectDiceSymbolWeights[symbol];
                                                            } else {
                                                                otherValue += symbolWeight;
                                                            }
                                                            let symbolOffensiveness = DICE_SYMBOL_OFFENSIVENESS[symbol];
                                                            offensiveness += symbolOffensiveness;
                                                        });
                                                    });
                                                    otherValue /= 5;

                                                    let weight;
                                                    if (isResourceDice) {
                                                        // rerolling this die isn't of interest to us
                                                        weight = 0;
                                                    } else {
                                                        weight = otherValue - currentValue;
                                                    }

                                                    let input = inputs[dice.diceId];
                                                    if (pos.x == input.tileX && pos.y == input.tileY) {
                                                        weight += collectBonus;
                                                    }
                                                    if (dice.owner != entity.id) {
                                                        weight = -weight;
                                                    }

                                                    arrayPush(
                                                        weightedDice,
                                                        <DiceAndWeight>{
                                                            dice: dice,
                                                            diceWeight: weight,
                                                            offensive: offensiveness > 0,
                                                            collect: <any>1
                                                        }
                                                    );
                                                }
                                            );

                                            weightedDice.sort(function (wd1: DiceAndWeight, wd2: DiceAndWeight) {
                                                return wd2.diceWeight - wd1.diceWeight;
                                            });
                                            randomizeArray(mathRandomNumberGenerator, weightedDice, entity.personality.randomness);

                                            // start throwing dice!
                                            arrayForEach(weightedDice, function (weightedDice: DiceAndWeight) {
                                                let dice = weightedDice.dice;
                                                if (!action && weightedDice.diceWeight >= 0) {
                                                    if (weightedDice.collect) {
                                                        let input = inputs[dice.diceId];
                                                        let canCollectDiceResult = canCollectDice(entity, input);
                                                        if (!action && !canCollectDiceResult.failureReason) {
                                                            action = collectDice(entity, canCollectDiceResult);
                                                        }
                                                    } else {
                                                        if (!weightedDice.offensive || tile.entity) {
                                                            let canPlayDiceResult = canPlayDice(entity, dice.diceId, !weightedDice.offensive);
                                                            if (!canPlayDiceResult.failureReason) {
                                                                action = playDice(entity, canPlayDiceResult);
                                                            }
                                                        }
                                                    }
                                                }
                                            });
                                        }
                                    }
                                } else {
                                    // hoover up any dice that are lying around
                                    mapForEach(tile.dice, function (position: string, diceAndFace: DiceAndFace) {
                                        if (!action && diceAndFace) {
                                            let canCollectDiceResult = canCollectDice(entity, {
                                                diceId: diceAndFace.dice.diceId,
                                                tileX: x,
                                                tileY: y,
                                                dicePosition: position
                                            });
                                            if (!canCollectDiceResult.failureReason) {
                                                action = collectDice(entity, canCollectDiceResult);
                                                // only pick one up at a time
                                                action.moveToNext = true;
                                            }

                                        }
                                    })
                                }
                            }
                        });
                    }
                    if (action && action.deltas) {
                        moveToNext = action.moveToNext;
                        deltas = action.deltas;
                    }
                    if (moveToNext) {
                        currentTurnEntityIndex = (currentTurnEntityIndex + 1) % entitiesInOrder.length;
                    }
                }
            } else {
                waitingOnInput = <any>1;
            }
            return {
                awaitingInput: waitingOnInput,
                deltas: deltas
            };
        },
        queueInput: function (input: Input): boolean {
            let localWaitingOnInput = waitingOnInput;
            waitingOnInput = <any>0;
            arrayPush(inputQueue, input);
            return localWaitingOnInput;
        },
        getEffectiveResourceCounts: function(entity: Entity): { [_: number]: number } {
            let effectiveResourceCounts = zeroResourceMap();
            let entityPos = levelGetPosition(level, entity);
            if (entityPos) {
                let tile = level.tiles[entityPos.x][entityPos.y];
                mapForEach(entity.resourceCounts, function (key: string, value: number) {
                    effectiveResourceCounts[key] += value;
                    // check any die we are sitting on
                    mapForEach(tile.dice, function (position: string, diceAndFace: DiceAndFace) {
                        if (diceAndFace) {
                            arrayForEach(diceAndFace.dice.symbols[diceAndFace.upturnedFace], function (symbol: DiceSymbol) {
                                let symbolResourceCounts = DICE_SYMBOL_RESOURCE_VALUES[key];
                                if (symbolResourceCounts) {
                                    let symbolResourceCount = symbolResourceCounts[symbol];
                                    if (symbolResourceCount < 0) {
                                        effectiveResourceCounts[key] += symbolResourceCount;
                                    }
                                }
                            });
                        }
                    });
                });
            }
            return effectiveResourceCounts;

        },
        getEffectiveHealth: function (entity: Entity): number {
            let entityPos = levelGetPosition(level, entity);
            return getEffectiveHealth(entity, entityPos.x, entityPos.y)
        } 
    };

    return levelUpdater;
    
}
