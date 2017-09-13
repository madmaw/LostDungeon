interface LevelPopulator {
    (
        game: Game,
        rng: RandomNumberGenerator,
        tiles: Tile[][],
        width: number,
        height: number,
        depth: number,
        tileDefinition: TileDefinition[]
    ): void;
}
