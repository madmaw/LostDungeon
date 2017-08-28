class LocalStorageGameService implements GameService {

    constructor(private prefix: string) {

    }

    getUniverse(): Universe {
        let universeString = localStorage.getItem(this.prefix);
        let universe: Universe;
        if (universeString) {
            universe = JSON.parse(universeString);
        } else {
            universe = {
                gameIds: [],
                nextGameId: 1
            };
        }
        return universe;
    }

    saveGame(game: Game): void {
        game.updated = (new Date()).toString();
        localStorage.setItem(this.prefix + game.gameId, JSON.stringify(game));
    }

    getGames(gameIds: GameId[]): Game[] {
        let games: Game[] = [];
        for (let gameId of gameIds) {
            let gameString = localStorage.getItem(this.prefix + gameId);
            let game = JSON.parse(gameString);
            games.push(game);
        }
        return games;
    }

    createGame(): Game {
        let universe = this.getUniverse();
        let gameId = universe.nextGameId++;
        universe.gameIds.push(gameId);
        localStorage.setItem(this.prefix, JSON.stringify(universe));
        let now = new Date().toString();
        let randomNumberSeed = Math.floor(Math.random() * 99999);
        let game: Game = {
            gameId: gameId,
            created: now, 
            nextLevelId: 1,
            nextEntityId: 1,
            randomNumberSeed: randomNumberSeed 
        }
        this.saveGame(game);
        return game;
    }

    createLevel(game: Game, width: number, height: number, tiles: Tile[][]): Level {
        let level: Level = {
            gameId: game.gameId,
            levelId: game.nextLevelId++,
            width: width, 
            height: height, 
            tiles: tiles
        };
        this.saveGame(game);
        return level;
    }

    getLevel(game: Game, levelId: LevelId): Level {
        let levelString = localStorage.getItem(this.prefix + game.gameId + '_' + levelId);
        let level: Level;
        if (levelString) {
            level = JSON.parse(levelString);
        } 
        return level;
    }

    saveLevel(game: Game, level: Level): void {
        this.saveGame(game);
        localStorage.setItem(this.prefix + game.gameId + '_' + level.levelId, JSON.stringify(level));
    }

    
}
