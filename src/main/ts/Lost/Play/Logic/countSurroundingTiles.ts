function countSurroundingTiles(
    tiles: Tile[][],
    width: number,
    height: number,
    tx: number,
    ty: number,
    f: (tile: Tile, tx?: number, ty?: number) => (number | void),
    includeCorners?: number
): number {
    let count = 0;
    let diffs = includeCorners ? ORIENTATION_DIFFS_CORNERS : ORIENTATION_DIFFS;
    for (let diff of diffs) {
        let x = tx + diff.x;
        let y = ty + diff.y;
        if (x >= 0 && x < width && y >= 0 && y < height) {
            let result = f(tiles[x][y], x, y);
            if (result) {
                count += result;
            }
        }
    }
    return count;
}
