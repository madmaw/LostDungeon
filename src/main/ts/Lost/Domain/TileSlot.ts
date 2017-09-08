interface TileSlot {
    dx: number;
    dy: number;
    rotation: number;
}

let TILE_SLOTS_OFFENSIVE: { [_: number]: TileSlot } = {};
let TILE_SLOTS_DEFENSIVE: { [_: number]: TileSlot } = {};
let TILE_SLOTS_ALL: { [_: number]: TileSlot } = {};
let dimension = 6;
let TILE_SLOT_COUNT = dimension * dimension;

let c = .5 / dimension - .5;
let piOn6 = pi / 6;
countForEach(dimension, function (x: number) {
    countForEach(dimension, function (y: number) {
        let tileSlotBag: { [_: string]: TileSlot };
        if (x && y && x < dimension - 1 && y < dimension - 1) {
            tileSlotBag = TILE_SLOTS_DEFENSIVE;
        } else {
            tileSlotBag = TILE_SLOTS_OFFENSIVE;
        }
        let index = x + y * dimension;
        let tileSlot = {
            dx: x / dimension + c,
            dy: y / dimension + c,
            rotation: random() * piOn6 + piOn6
        };
        tileSlotBag[index] = tileSlot;
        TILE_SLOTS_ALL[index] = tileSlot;
    });
});


