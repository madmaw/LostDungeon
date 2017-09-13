function localStorageGameServiceFactory (prefix: string): GameService {

    function saveGame(game: Game): void {
        game.updated = (new Date()).toLocaleString();
        ls.setItem(prefix + game.gameId, JSON.stringify(game));
    }

    var result = {

        getUniverse: function (): Universe {
            let universe: Universe;
            if (FEATURE_PERSISTENCE ) {
                let universeString = ls.getItem(prefix);
                if (universeString) {
                    universe = JSON.parse(universeString);
                }            
            }
            if (!universe) {
                universe = {
                    gameIds: [],
                    nextGameId: 1
                };
            }
            return universe;
        },

        getGames: function(gameIds: GameId[]): Game[] {
            let games: Game[] = [];
            if (FEATURE_PERSISTENCE) {
                arrayForEach(gameIds, function (gameId: GameId) {
                    let gameString = ls.getItem(prefix + gameId);
                    let game = JSON.parse(gameString);
                    arrayPush(games, game);
                });
            }
            return games;
        },

        createGame: function(): Game {
            let universe = result.getUniverse();
            let gameId = universe.nextGameId++;
            arrayPush(universe.gameIds, gameId);
            ls.setItem(prefix, JSON.stringify(universe));
            let now = new Date().toString();
            let game: Game = {
                gameId: gameId,
                created: now,
                nextLevelId: 1,
                nextEntityId: 1
            }
            if (FEATURE_PERSISTENCE) {
                saveGame(game);
            }
            return game;
        },

        createLevel: function(game: Game, width: number, height: number, tiles: Tile[][]): Level {
            let level: Level = {
                gameId: game.gameId,
                levelId: game.nextLevelId++,
                levelWidth: width,
                levelHeight: height,
                tiles: tiles
            };
            if (FEATURE_PERSISTENCE) {
                saveGame(game);
            }
            return level;
        },

        getLevel: function (game: Game, levelId: LevelId): Level {
            let level: Level;
            if (FEATURE_PERSISTENCE) {
                let levelString = ls.getItem(prefix + game.gameId + '_' + levelId);
                if (levelString) {
                    level = JSON.parse(levelString);
                }
            }
            return level;
        },

        saveLevel: function (game: Game, level: Level): void {
            if (FEATURE_PERSISTENCE) {
                saveGame(game);
                if (level) {
                    ls.setItem(prefix + game.gameId + '_' + level.levelId, JSON.stringify(level));
                }
            }
        }

    }

    return result;

}
