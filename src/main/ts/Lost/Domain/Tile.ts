interface DiceAndFace {
    dice: Dice;
    face: DiceFace;
}

interface Tile {
    type: TileType;
    entity?: Entity;
    name?: string;
    dice: { [_: string]: DiceAndFace };
}
