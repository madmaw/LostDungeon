function levelFindTile(level: Level, searchFunction: (tile: Tile, x?: number, y?: number) => boolean | void): Tile {
    for (let x = 0; x < level.width; x++) {
        let column = level.tiles[x];
        for (let y = 0; y < level.height; y++) {
            let tile = column[y];
            if (searchFunction(tile, x, y)) {
                return tile;
            }
        }
    }
    return nil;
}
