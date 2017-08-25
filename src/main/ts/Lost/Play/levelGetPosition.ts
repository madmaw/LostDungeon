function levelGetPosition(level: Level, entity: Entity): Point {
    let point: Point;
    levelFindTile(level, function (tile: Tile, x: number, y: number) {
        if (tile.entity == entity) {
            point = {
                x: x,
                y: y
            };
            return true;
        }
    });
    return point;
}
