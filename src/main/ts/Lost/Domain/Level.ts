interface Level {
    gameId: GameId;
    levelId: LevelId;
    depth: number;
    width: number;
    height: number;
    tiles: Tile[][];
}
