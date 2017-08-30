///<reference path="PlayState.ts"/>

function playStateFactory(gameService: GameService, levelPopulator: LevelPopulator): StateFactory {
    return function (stateTypeId: StateTypeId, data: PlayStateData) {
        let game = data.game;

        let levelId: LevelId;
        if (data.playerTransition) {
            levelId = data.playerTransition.location.levelId;
        } else {
            levelId = game.playerLevelId;
        }
        let level = gameService.getLevel(game, levelId);
        if (!level) {
            // need to create a level
            let rng = trigRandomNumberGeneratorFactory(game.randomNumberSeed + levelId * 999);
            let squareSide = 7 + (levelId>>1);
            let area = squareSide * squareSide + levelId;
            let width = squareSide + rng(squareSide/4) - rng(squareSide/4);
            let height = Math.ceil(area / width);
            let tiles = create2DArray(width, height, function (x: number, y: number) {
                /*
                let name: string;
                if (x == startX && y == startY && data.playerTransition) { 
                    name = data.playerTransition.location.tileName;
                }
                let type: TileType;
                if (x == 2 && y == 2) {
                    type = TILE_TYPE_SOLID;
                } else {
                    type = TILE_TYPE_FLOOR;
                }
                */
                let dice: Dice = {
                    diceId: game.nextEntityId++,
                    level: rng(5),
                    symbols: [
                        [DICE_SYMBOL_ATTACK],
                        [DICE_SYMBOL_ATTACK, DICE_SYMBOL_DEFEND, DICE_SYMBOL_RESOURCE_FIRE, DICE_SYMBOL_RESOURCE_FIRE],
                        [DICE_SYMBOL_DEFEND],
                        [DICE_SYMBOL_RESOURCE_FIRE, DICE_SYMBOL_RESOURCE_FIRE, DICE_SYMBOL_RESOURCE_FIRE, DICE_SYMBOL_RESOURCE_FIRE],
                        [DICE_SYMBOL_RESOURCE_LIFE, DICE_SYMBOL_RESOURCE_LIFE, DICE_SYMBOL_RESOURCE_LIFE],
                        [DICE_SYMBOL_RESOURCE_FIRE, DICE_SYMBOL_RESOURCE_LIFE, DICE_SYMBOL_RESOURCE_WATER, DICE_SYMBOL_DEFEND]
                    ],
                    type: rng(4)
                }
                let tile: Tile = {
                    type: TILE_TYPE_SOLID,
                    dice: {
                        1: {
                            dice: dice,
                            face: rng(6)
                        }
                    }
                };
                return tile;
            });
            levelPopulator(rng, tiles, width, height, levelId);

            // add in a start point and an exit

            let featureCount = 0;
            let attemptsRemaining = 99;
            o: while (1) {
                let tx = rng(width);
                let ty = rng(height);
                let tile = tiles[tx][ty];
                let justDoIt = attemptsRemaining < 0;
                attemptsRemaining--;
                if (justDoIt) {
                    console.log('gave up searching!');
                }
                if ((tile.type == TILE_TYPE_FLOOR || justDoIt || featureCount) && tile.name != data.playerTransition.location.tileName) {
                    let floors = countSurroundingTiles(tiles, width, height, tx, ty, function (tile: Tile) {
                        return tile.type == TILE_TYPE_FLOOR ? 1 : 0;
                    });

                    if (floors == 1 || featureCount && tile.type == TILE_TYPE_SOLID && floors || justDoIt) {
                        switch (featureCount) {
                            case 0:
                                tile.name = data.playerTransition.location.tileName;
                                tile.type = TILE_TYPE_ROOFLESS;
                                break;
                            case 1:
                                tile.type = TILE_TYPE_PIT;
                                break o;
                        }
                        featureCount++;
                    }
                }
            }


            level = gameService.createLevel(game, width, height, tiles);
        }
        let viewer: Entity;
        let deltas: LevelDelta[];
        if (data.playerTransition) {
            // need to add the player to the level at the specified spot
            let tile = levelFindTile(level, function(tile: Tile) {
                return tile.name == data.playerTransition.location.tileName; 
            });
            if (!tile) {
                tile = level.tiles[0][0];
            }
            viewer = data.playerTransition.entity;
            tile.entity = viewer;

            deltas = [{
                type: LEVEL_DELTA_TYPE_DROP_IN,
                data: {
                    entity: viewer
                }
            }];
        } else {
            let tile = levelFindTile(level, function (tile: Tile) {
                return tile.entity && tile.entity.behaviorType == BEHAVIOR_TYPE_PLAYER;
            });
            viewer = tile.entity;
        }
        for (let y = 0; y < level.height; y++) {
            let s = '' + y + ':';
            for (let x = 0; x < level.width; x++) {
                let tile = level.tiles[x][y];
                s += tile.type == TILE_TYPE_SOLID ? '#' : (tile.type == TILE_TYPE_FLOOR ? ' ' : tile.type.toString());
            }
            console.log(s);
        }


        game.playerLevelId = level.levelId;
        gameService.saveLevel(game, level);
        let state = new PlayState(gameService, game, level, viewer, deltas);
        return state;
    }
}
