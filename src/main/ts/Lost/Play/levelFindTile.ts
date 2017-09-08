interface AbridgedLevel {
    tiles: Tile[][];
    levelWidth: number;
    levelHeight: number;
}

function levelFindTile(level: AbridgedLevel, searchFunction: (tile: Tile, x?: number, y?: number) => boolean | void): Tile {
    let total = level.levelWidth * level.levelHeight;
    for (let i= 0; i < total; i++) {
        let x = i % level.levelWidth;
        let y = floor(i / level.levelWidth);
        let column = level.tiles[x];
        let tile = column[y];
        if (searchFunction(tile, x, y)) {
            return tile;
        }
    }
}
