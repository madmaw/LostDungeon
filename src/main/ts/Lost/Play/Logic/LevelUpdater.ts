interface LevelUpdater {
    update(): LevelUpdate;
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

function createLevelUpdater(game: Game, level: Level): LevelUpdater {

    let entitiesInOrder: Entity[] = [];
    let currentTurnEntityIndex = 0;
    let inputQueue: Input[] = [];
    let waitingOnInput: boolean;
    

    // add the entities in order (of side)
    levelFindTile(level, function (tile) {
        if (tile.entity) {
            entitiesInOrder.push(tile.entity);
        }
    });

    function zeroResourceMap(): { [_: number]: number } {
        return {
            // fire
            1: 0,
            // water
            2: 0,
            // life
            3: 0
        };
    }

    function sortEntitiesInOrder() {
        entitiesInOrder.sort(function (a: Entity, b: Entity) {
            return a.id - b.id;
        })
    }

    function turnToOrientation(entity: Entity, orientation: Orientation): ActionResult {
        let oldOrientation = entity.entityOrientation;
        entity.entityOrientation = orientation;
        return {
            deltas: [{
                type: LEVEL_DELTA_TYPE_TURN,
                data: {
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
            valid = targetTile.type != TILE_TYPE_SOLID && !targetTile.entity;
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
                if (targetTile.type == TILE_TYPE_PIT) {
                    let fallChildren: LevelDelta[] = [{
                        type: LEVEL_DELTA_TYPE_DIE,
                        data: {
                            entity: entity
                        }
                    }];
                    if (entity.behaviorType == BEHAVIOR_TYPE_PLAYER) {
                        fallChildren.push({
                            type: LEVEL_DELTA_TYPE_CHANGE_STATE,
                            data: {
                                stateTypeId: STATE_TYPE_PLAY,
                                stateData: {
                                    game: game,
                                    playerTransition: {
                                        entity: entity,
                                        entryLocation: {
                                            levelId: game.nextLevelId,
                                            tileName: targetTile.name
                                        }
                                    }

                                }
                            }
                        });
                    }
                    children = [
                        {
                            type: LEVEL_DELTA_TYPE_FALL,
                            data: {
                                entity: entity,
                                tileX: pos.x,
                                tileY: pos.y
                            },
                            children: fallChildren
                        }
                    ]
                } else {
                    children = applyAmbientEffects(entity, previousHealth);
                }
                deltas = [{
                    type: LEVEL_DELTA_TYPE_MOVE,
                    data: moveData,
                    children: children
                }, {
                    type: LEVEL_DELTA_TYPE_RESOURCE_CHANGE,
                    data: resourceDelta
                }]
            }
        }
        if (!valid) {
            deltas = [{
                type: LEVEL_DELTA_TYPE_MOVE_INVALID,
                data: moveData
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
                    let symbols = diceAndFace.dice.symbols[diceAndFace.face];
                    arrayForEach(symbols, function (symbol: DiceSymbol) {
                        if (symbol == DICE_SYMBOL_ATTACK) {
                            health--;
                        }
                    });
                }
            });
            return health;
        }
    }

    function applyAmbientEffects(entity: Entity, currentHealth: number): LevelDelta[] {
        // check health 
        let entityPos = levelGetPosition(level, entity);
        let result: LevelDelta[] = [];
        let newHealth = getEffectiveHealth(entity, entityPos.x, entityPos.y);
        let delta = newHealth - currentHealth;
        if (delta) {
            let children: LevelDelta[];
            entity.dead = newHealth <= 0;
            if (entity.dead) {
                let tile = level.tiles[entityPos.x][entityPos.y];
                tile.entity = nil;
                children = [
                    {
                        type: LEVEL_DELTA_TYPE_DIE,
                        data: <LevelDeltaDataDie>{
                            entity: entity
                        }
                    }
                ];
            }
            result.push({
                type: LEVEL_DELTA_TYPE_HEALTH_CHANGE,
                data: <LevelDeltaDataHealthChange>{
                    entity: entity,
                    deltaHealth: delta,
                    totalHealth: newHealth,
                },
                children: children
            })
        }

        return result;
    }

    function look(entity: Entity, down?: boolean): ActionResult {
        let deltas: LevelDelta[];
        if (entity.lookingDown != down) {
            entity.lookingDown = down;
            deltas = [{
                type: down ? LEVEL_DELTA_TYPE_LOOK_DOWN : LEVEL_DELTA_TYPE_LOOK_UP,
                data: {
                    entity: entity
                }
            }]            
        }
        return {  
            deltas: deltas
        };

    }

    function collectDice(entity: Entity, data: InputDataCollectDice): ActionResult {
        let deltas: LevelDelta[];
        // is the entity close enough?
        let entityPos = levelGetPosition(level, entity);
        let diff = abs(entityPos.x - data.tileX) + abs(entityPos.y - data.tileY);

        let fromTile = level.tiles[data.tileX][data.tileY];
        let diceAndFace = fromTile.dice[data.position];
        if (diff <= 1 && diceAndFace) {
            // ensure we have the entire array at our disposal
            while (entity.dice.length < entity.diceSlots) {
                entity.dice.push(nil);
            }
            // find a spot
            arrayForEach(entity.dice, function (dice: Dice, index: number) {
                if (!deltas && !dice) {
                    fromTile.dice[data.position] = nil;
                    entity.dice[index] = diceAndFace.dice;

                    // harvest any values of the dice
                    let resourceValues = entity.resourceCounts;
                    let resourceValueDeltas: { [_: number]: number } = zeroResourceMap();
                    if (!diff) {
                        arrayForEach(diceAndFace.dice.symbols[diceAndFace.face], function (symbol: DiceSymbol) {
                            let symbolResourceValues = DICE_SYMBOL_RESOURCE_VALUES[symbol];
                            mapForEach(symbolResourceValues, function (resourceType: string, value: number) {
                                resourceValues[resourceType] += value;
                                resourceValueDeltas[resourceType] += value;
                            });
                        });
                    }

                    deltas = [
                        {
                            type: LEVEL_DELTA_TYPE_COLLECT_DICE,
                            data: <LevelDeltaDataCollectDice>{
                                entity: entity,
                                dice: diceAndFace.dice,
                                toDiceSlot: index,
                                fromTileX: data.tileX,
                                fromTileY: data.tileY,
                                fromTilePosition: data.position,
                                fromFace: diceAndFace.face
                            },
                            children: [
                                {
                                    type: LEVEL_DELTA_TYPE_RESOURCE_CHANGE,
                                    data: <LevelDeltaDataResourceChange>{
                                        entity: entity,
                                        resourceDeltas: resourceValueDeltas,
                                        newEffectiveResourceCounts: levelUpdater.getEffectiveResourceCounts(entity)
                                    }
                                }
                            ]
                        }
                    ];

                }

            })
        }
        return {
            deltas: deltas
        }
    }

    function canPlayDice(entity: Entity, diceId: DiceId): CanPlayDiceResult {
        let entityPos = levelGetPosition(level, entity);
        let toTileX: number;
        let toTileY: number;
        let targetOrientation: Orientation;
        let slots: { [_: number]: TileSlot };
        if (entity.lookingDown) {
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

            if (tile.type != TILE_TYPE_SOLID) {
                let targetDiff = ORIENTATION_DIFFS[targetOrientation];
                let targetSlotKey = getBestAvailableTileSlotKey(slots, tile, targetDiff.x, targetDiff.y);
                if (targetSlotKey != nil) {
                    result.toTilePosition = targetSlotKey;
                    arrayForEachReverse(entity.dice, function (dice: Dice, index: number) {
                        if (dice && dice.diceId == diceId) {
                            result.dice = dice;
                            result.fromDiceSlot = index;
                        }
                    });
                    if (result.dice) {
                        if (tile.entity != null) {
                            // we need to check we we can affort to play the dice (you can throw whatever you want into unoccupied tiles)
                            let resourceType = result.dice.type;
                            let resourceQuantity = result.dice.level;
                            if (resourceType && resourceQuantity) {
                                let resourcesUsed: { [_: number]: number } = {};
                                let effectiveResourceCounts = levelUpdater.getEffectiveResourceCounts(entity);
                                let effectiveResourceCount = effectiveResourceCounts[resourceType];
                                if (effectiveResourceCount < result.dice.level) {
                                    failureReason = PLAY_DICE_FAILURE_REASON_NO_RESOURCES;
                                } else {
                                    resourcesUsed[resourceType] = -resourceQuantity;
                                }
                                result.resourcesUsed = resourcesUsed;
                            }
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

    function playDice(entity: Entity, diceId: DiceId): ActionResult {
        let deltas: LevelDelta[];
        let canPlayDiceResult = canPlayDice(entity, diceId);
        let success = !canPlayDiceResult.failureReason;
        if (success) {
            let face = floor(random() * 6);
            let tile = level.tiles[canPlayDiceResult.toTileX][canPlayDiceResult.toTileY];
            let previousHealth = getEffectiveHealth(tile.entity, canPlayDiceResult.toTileX, canPlayDiceResult.toTileY);
            tile.dice[canPlayDiceResult.toTilePosition] = {
                dice: canPlayDiceResult.dice,
                face: face
            };
            // TODO if we are throwing it into a pit, kill the dice on landing
            entity.dice[canPlayDiceResult.fromDiceSlot] = nil;

            let ambientEffects: LevelDelta[];
            if (tile.entity) {
                ambientEffects = applyAmbientEffects(tile.entity, previousHealth);
            }
            let playDelta: LevelDelta = {
                type: LEVEL_DELTA_TYPE_PLAY_DICE,
                data: {
                    entity: entity,
                    dice: canPlayDiceResult.dice,
                    fromDiceSlot: canPlayDiceResult.fromDiceSlot,
                    toFace: face,
                    toTileX: canPlayDiceResult.toTileX,
                    toTileY: canPlayDiceResult.toTileY,
                    toTilePosition: canPlayDiceResult.toTilePosition
                },
                children: ambientEffects
            };

            if (canPlayDiceResult.resourcesUsed) {
                let rolledAFreebee: boolean;
                // TODO have symbols that let you keep your resources if you roll them
                let resourcesUsed: { [_: number]: number };
                if (rolledAFreebee) {
                    mapForEach(canPlayDiceResult.resourcesUsed, function (resourceType: string, amount: number) {
                        entity.resourceCounts[canPlayDiceResult.dice.type] += amount;
                    });
                    resourcesUsed = canPlayDiceResult.resourcesUsed;
                } else {
                    // always zero out on a successful throw
                    resourcesUsed = levelUpdater.getEffectiveResourceCounts(entity);
                    entity.resourceCounts = zeroResourceMap();
                }
                // push delta for resource count change
                deltas = [
                    {
                        type: LEVEL_DELTA_TYPE_RESOURCE_CHANGE,
                        data: <LevelDeltaDataResourceChange>{
                            entity: entity,
                            newEffectiveResourceCounts: levelUpdater.getEffectiveResourceCounts(entity),
                            resourceDeltas: resourcesUsed
                        },
                        children: [playDelta]
                    }
                ];
            } else {
                deltas = [playDelta];
            }


        }
        return {
            moveToNext: success,
            deltas: deltas
        }
        
    }

    let levelUpdater: LevelUpdater = {
        update: function (): LevelUpdate {
            let deltas: LevelDelta[];
            if (entitiesInOrder.length) {
                let index = currentTurnEntityIndex;
                let entity = entitiesInOrder[index];
                let action: ActionResult;
                if (entity.dead) {
                    entitiesInOrder.splice(index, 1);
                    currentTurnEntityIndex = currentTurnEntityIndex % entitiesInOrder.length;
                } else {
                    let moveToNext: boolean;
                    if (entity.behaviorType == BEHAVIOR_TYPE_PLAYER) {
                        waitingOnInput = inputQueue.length == 0;
                        if (!waitingOnInput) {
                            let input = inputQueue.splice(0, 1)[0];
                            switch (input.type) {
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
                                case INPUT_TYPE_TURN_LEFT:
                                    let orientation = entity.entityOrientation - 1;
                                    if (orientation < ORIENTATION_NORTH) {
                                        orientation = ORIENTATION_WEST;
                                    }
                                    action = turnToOrientation(entity, orientation);
                                    break;
                                case INPUT_TYPE_TURN_RIGHT:
                                    action = turnToOrientation(entity, (entity.entityOrientation + 1) % 4);
                                    break;
                                case INPUT_TYPE_COLLECT_DICE:
                                    action = collectDice(entity, <InputDataCollectDice>input.data);
                                    break;
                                case INPUT_TYPE_PLAY_DICE:
                                    action = playDice(entity, (<InputDataPlayDice>input.data).diceId);
                                    break;
                            }
                        }
                    } else {
                        // do some AI stuff
                        // always face the player if they are adjacent
                        let pos = levelGetPosition(level, entity);
                        moveToNext = <any>1;
                        arrayForEach(ORIENTATION_DIFFS, function (diff: Point, orientation: Orientation) {
                            let x = pos.x + diff.x;
                            let y = pos.y + diff.y;
                            if (x >= 0 && y >= 0 && x < level.levelWidth && y < level.levelHeight) {
                                let tile = level.tiles[x][y];
                                if (tile.entity) {
                                    if (tile.entity.behaviorType == BEHAVIOR_TYPE_PLAYER) {
                                        if (orientation != entity.entityOrientation) {
                                            action = turnToOrientation(entity, orientation);
                                        } else {
                                            // start throwing dice!
                                            arrayForEach(entity.dice, function (dice: Dice) {
                                                if (dice) {
                                                    let canPlayDiceResult = canPlayDice(entity, dice.diceId);
                                                    if (!action && !canPlayDiceResult.failureReason) {
                                                        action = playDice(entity, dice.diceId);
                                                    }
                                                }
                                            });
                                        }
                                    }
                                } else {
                                    // hoover up any dice that are lying around
                                    mapForEach(tile.dice, function (position: string, diceAndFace: DiceAndFace) {
                                        if (!action && diceAndFace) {
                                            action = collectDice(entity, {
                                                diceId: diceAndFace.dice.diceId,
                                                tileX: x,
                                                tileY: y,
                                                position: position
                                            });

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
                        currentTurnEntityIndex = (index + 1) % entitiesInOrder.length;
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
            inputQueue.push(input);
            return localWaitingOnInput;
        },
        getEffectiveResourceCounts: function(entity: Entity): { [_: number]: number } {
            let entityPos = levelGetPosition(level, entity);            
            let effectiveResourceCounts = zeroResourceMap();
            mapForEach(entity.resourceCounts, function (key: string, value: number) {
                effectiveResourceCounts[key] += value;
            });
            return effectiveResourceCounts;

        },
        getEffectiveHealth: function (entity: Entity): number {
            let entityPos = levelGetPosition(level, entity);
            return getEffectiveHealth(entity, entityPos.x, entityPos.y)
        } 
    };

    return levelUpdater;
    
}
