interface DiceAndFace {
    dice: Dice;
    upturnedFace: DiceFace;
}

interface Tile {
    tileType: TileType;
    entity?: Entity;
    tileName?: string;
    scribbles?: string[];
    featureType?: FeatureType;
    dice: { [_: string]: DiceAndFace };
}
