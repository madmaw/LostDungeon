type TileType = number;

const TILE_TYPE_SOLID = 0;
const TILE_TYPE_FLOOR = 1;
const TILE_TYPE_PIT = 2;
const TILE_TYPE_ROOFLESS = 3;
const TILE_TYPE_HIDDEN = 4;

function isTileTypeSolid(tileType: TileType) {
    return tileType == TILE_TYPE_SOLID;
}
