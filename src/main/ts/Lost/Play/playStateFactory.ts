///<reference path="PlayState.ts"/>

function playStateFactory(gameService: GameService): StateFactory {
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
            let width = 5;
            let height = 5;
            let startX = Math.floor(Math.random() * width);
            let startY = Math.floor(Math.random() * height);
            startX = 2;
            startY = 4;
            let tiles = create2DArray(width, height, function(x: number, y: number) {
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
                let tile: Tile = {
                    type: type,
                    name: name   
                };
                return tile;
            });
            level = gameService.createLevel(game, width, height, tiles);
        }
        let viewer: Entity;
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
        } else {
            let tile = levelFindTile(level, function (tile: Tile) {
                return tile.entity && tile.entity.behaviorType == BEHAVIOR_TYPE_PLAYER;
            });
            viewer = tile.entity;
        }
        game.playerLevelId = level.levelId;
        gameService.saveLevel(game, level);
        return new PlayState(gameService, game, level, viewer);
    }
}
