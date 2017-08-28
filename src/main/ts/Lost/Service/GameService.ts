interface GameService {
    getUniverse(): Universe;
    
    getGames(gameIds: GameId[]): Game[];

    createGame(): Game;

    createLevel(game: Game, width: number, height: number, tiles: Tile[][]): Level;

    getLevel(game: Game, levelId: LevelId): Level;

    saveLevel(game: Game, level: Level): void;
}
