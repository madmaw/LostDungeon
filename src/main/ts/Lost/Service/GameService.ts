interface GameService {
    getUniverse(): Universe;
    
    getGames(gameIds: string[]): Game[];

    createGame(): Game;

    createLevel(game: Game, width: number, height: number, tiles: Tile[][]): Level;

    getLevel(game: Game, levelId: string): Level;

    saveLevel(game: Game, level: Level): void;
}