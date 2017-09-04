class LevelUpdater {

    private entitiesInOrder: Entity[];
    private currentTurnEntityIndex: number;
    private inputQueue: Input[];
    private waitingOnInput: boolean;
    

    constructor(private game: Game, private level: Level) {
        this.entitiesInOrder = [];
        // add the entities in order (of side)
        levelFindTile(level, (tile) => {
            if (tile.entity) {
                this.entitiesInOrder.push(tile.entity);
            }
        });
        this.sortEntitiesInOrder();
        this.currentTurnEntityIndex = 0;
        this.inputQueue = [];

    }

    sortEntitiesInOrder() {
        this.entitiesInOrder.sort(function (a: Entity, b: Entity) {
            return a.id - b.id;
        })
    }

    queueInput(input: Input): boolean {
        let waitingOnInput = this.waitingOnInput;
        this.waitingOnInput = false;
        this.inputQueue.push(input);
        return waitingOnInput;
    }

    updateLevel(): LevelUpdate {
        let index = this.currentTurnEntityIndex;
        let entity = this.entitiesInOrder[index];
        let deltas: LevelDelta[];
        let moveToNext: boolean;
        if (entity.behaviorType == BEHAVIOR_TYPE_PLAYER) {
            this.waitingOnInput = this.inputQueue.length == 0;
            if (!this.waitingOnInput) {
                let input = this.inputQueue.splice(0, 1)[0];
                let action: ActionResult;
                switch (input.type) {
                    case INPUT_TYPE_LOOK_DOWN:
                        action = this.look(entity, <any>1);
                        break;
                    case INPUT_TYPE_MOVE_FORWARD:
                        if (entity.lookingDown) {
                            action = this.look(entity);
                        } else {
                            action = this.moveForward(entity);
                        }
                        break;
                    case INPUT_TYPE_TURN_LEFT:
                        let orientation = entity.orientation - 1;
                        if (orientation < ORIENTATION_NORTH) {
                            orientation = ORIENTATION_WEST;
                        }
                        action = this.turnToOrientation(entity, orientation);
                        break;
                    case INPUT_TYPE_TURN_RIGHT:
                        action = this.turnToOrientation(entity, (entity.orientation + 1) % 4);
                        break;
                    case INPUT_TYPE_COLLECT_DICE:
                        action = this.collectDice(entity, <InputDataCollectDice>input.data);
                        break;
                    case INPUT_TYPE_PLAY_DICE:
                        action = this.playDice(entity, <InputDataPlayDice>input.data);
                        break;
                }
                if (action) {
                    moveToNext = action.moveToNext;
                    deltas = action.deltas;
                }
            }
        } else {
            // do some AI stuff

        }
        if (moveToNext) {
            this.currentTurnEntityIndex = (index + 1) % this.entitiesInOrder.length;
        }

        return {
            awaitingInput: this.waitingOnInput,
            deltas: deltas
        };
    }

    turnToOrientation(entity: Entity, orientation: Orientation): ActionResult {
        let oldOrientation = entity.orientation;
        entity.orientation = orientation;
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

    moveForward(entity: Entity): ActionResult {
        let orientation = entity.orientation;
        let dpos = ORIENTATION_DIFFS[orientation];

        let pos = levelGetPosition(this.level, entity);
        let x = pos.x + dpos.x;
        let y = pos.y + dpos.y;
        let valid = x >= 0 && y >= 0 && x < this.level.width && y < this.level.height;
        let deltaType: LevelDeltaType = LEVEL_DELTA_TYPE_MOVE_INVALID;
        let children: LevelDelta[];
        let moveData: LevelDeltaDataMove = {
            direction: orientation,
            fromX: pos.x,
            fromY: pos.y,
            entity: entity
        };
        if (valid) {
            let targetTile = this.level.tiles[x][y];
            valid = targetTile.type != TILE_TYPE_SOLID && !targetTile.entity;
            if (valid) {
                // move the entity
                let sourceTile = this.level.tiles[pos.x][pos.y];
                sourceTile.entity = nil;
                targetTile.entity = entity;
                // update the deltas
                deltaType = LEVEL_DELTA_TYPE_MOVE;

                // did we move onto a pit?
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
                                    game: this.game,
                                    playerTransition: {
                                        entity: entity,
                                        location: {
                                            levelId: this.game.nextLevelId,
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
                }
            }
        }
        return {
            moveToNext: valid,
            deltas: [
                {
                    type: deltaType,
                    data: moveData,
                    children: children
                }
            ]
        }
    }

    look(entity: Entity, down?: boolean): ActionResult {
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

    collectDice(entity: Entity, data: InputDataCollectDice): ActionResult {
        let deltas: LevelDelta[];
        // is the entity close enough?
        let entityPos = levelGetPosition(this.level, entity);
        let diff = abs(entityPos.x - data.tileX) + abs(entityPos.y - data.tileY);

        if (diff <= 1 && entity.dice.length < entity.diceSlots) {
            let fromTile = this.level.tiles[data.tileX][data.tileY];
            let diceAndFace = fromTile.dice[data.position];
            fromTile.dice[data.position] = nil;
            entity.dice.push(diceAndFace.dice);
            deltas = [{
                type: LEVEL_DELTA_TYPE_COLLECT_DICE,
                data: <LevelDeltaDataCollectDice>{
                    entity: entity,
                    dice: diceAndFace.dice,
                    fromTileX: data.tileX,
                    fromTileY: data.tileY,
                    fromTilePosition: data.position,
                    fromFace: diceAndFace.face
                }
            }];
        }
        return {
            deltas: deltas
        }
    }

    playDice(entity: Entity, data: InputDataPlayDice): ActionResult {
        let deltas: LevelDelta[];

        let entityPos = levelGetPosition(this.level, entity);
        let toTileX: number;
        let toTileY: number;
        let targetOrientation: Orientation;
        let slots: { [_: number]: TileSlot };
        if (entity.lookingDown) {
            // play to current tile
            toTileX = entityPos.x;
            toTileY = entityPos.y;
            targetOrientation = entity.orientation;
            slots = TILE_SLOTS_DEFENSIVE;
        } else {
            // play to oriented tile
            let delta = ORIENTATION_DIFFS[entity.orientation];
            toTileX = entityPos.x + delta.x;
            toTileY = entityPos.y + delta.y;
            targetOrientation = (entity.orientation + 2) % 4;
            slots = TILE_SLOTS_OFFENSIVE;
        }
        let success: boolean;
        if (toTileX >= 0 && toTileY >= 0 && toTileX < this.level.width && toTileY < this.level.height) {
            // find a free slot on the tile that best matches our target orientation
            let tile = this.level.tiles[toTileX][toTileY];
            
            if (tile.type != TILE_TYPE_SOLID) {
                let targetDiff = ORIENTATION_DIFFS[targetOrientation];
                let targetSlotKey = getBestAvailableTileSlotKey(slots, tile, targetDiff.x, targetDiff.y);
                if (targetSlotKey != nil) {
                    arrayForEach(entity.dice, function (dice: Dice, index: number) {
                        if (dice.diceId == data.diceId) {
                            let dice = entity.dice.splice(index, 1)[0];
                            let face = floor(random() * 6);
                            tile.dice[targetSlotKey] = {
                                dice: dice,
                                face: face
                            };

                            // find the dice
                            deltas = [{
                                type: LEVEL_DELTA_TYPE_PLAY_DICE,
                                data: {
                                    entity: entity,
                                    dice: dice,
                                    toFace: face,
                                    toTileX: toTileX,
                                    toTileY: toTileY,
                                    toTilePosition: targetSlotKey
                                }
                            }];

                            // TODO if we are throwing it into a pit, kill the dice on landing
                            success = <any>1;
                        }
                    });
                }
            }

        }
        return {
            moveToNext: success,
            deltas: deltas
        }
        
    }
}
