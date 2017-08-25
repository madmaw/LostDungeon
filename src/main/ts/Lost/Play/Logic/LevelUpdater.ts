class LevelUpdater {

    private entitiesInOrder: Entity[];
    private currentTurnEntityIndex: number;
    private inputQueue: Input[];
    private waitingOnInput: boolean;
    private inputHandlers: { [_: number]: (entity: Entity, data: InputData) => ActionResult };

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

        this.inputHandlers = {};
        this.inputHandlers[INPUT_TYPE_MOVE_FORWARD] = (entity: Entity) => {
            return this.moveForward(entity);
        };
        this.inputHandlers[INPUT_TYPE_TURN_LEFT] = (entity: Entity) => {
            let orientation = entity.orientation - 1;
            if (orientation < ORIENTATION_NORTH) {
                orientation = ORIENTATION_WEST;
            }
            return this.turnToOrientation(entity, orientation);
        };
        this.inputHandlers[INPUT_TYPE_TURN_RIGHT] = (entity: Entity) => {
            return this.turnToOrientation(entity, (entity.orientation + 1)%4);
        };
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
                let action: ActionResult = this.inputHandlers[input.type](entity, input.data);
                moveToNext = action.moveToNext;
                deltas = action.deltas;
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
        let moveData: LevelDeltaDataMove = {
            direction: orientation,
            fromX: pos.x,
            fromY: pos.y,
            entity: entity
        };
        if (valid) {
            let targetTile = this.level.tiles[x][y];
            valid = targetTile.type != TILE_TYPE_SOLID && targetTile.entity == null;
            if (valid) {
                // move the entity
                let sourceTile = this.level.tiles[pos.x][pos.y];
                sourceTile.entity = null;
                targetTile.entity = entity;
                // update the deltas
                deltaType = LEVEL_DELTA_TYPE_MOVE;
            }
        }
        return {
            moveToNext: valid,
            deltas: [
                {
                    type: deltaType,
                    data: moveData
                }
            ]
        }
    }
}
