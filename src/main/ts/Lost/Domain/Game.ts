interface Game {
    gameId: GameId;
    created: string;
    updated?: string;
    nextLevelId: number;
    nextEntityId: number;
    playerLevelId?: LevelId;
    gameState?: GameState;
}
