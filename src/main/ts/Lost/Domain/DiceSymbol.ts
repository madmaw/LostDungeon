type DiceSymbol = number;

let DICE_SYMBOL_ATTACK: DiceSymbol = 0;
let DICE_SYMBOL_DEFEND: DiceSymbol = 1;
let DICE_SYMBOL_RESOURCE_FIRE: DiceSymbol = 2;
let DICE_SYMBOL_RESOURCE_WATER: DiceSymbol = 3;
let DICE_SYMBOL_RESOURCE_LIFE: DiceSymbol = 4;

let DICE_SYMBOL_COUNT = 5;

let DICE_SYMBOL_CHARACTERS: string[] = [
    '†',
    '♥',
    '●',
    '●',
    '●'
];
let DICE_SYMBOL_COLORS: string[] = [
    '#000',
    '#000',
    '#800',
    '#008',
    '#080'
];
let DICE_SYMBOL_ROTATION: number[] = [
    -piOn2,
    piOn2,
    -piOn2,
    -piOn2,
    -piOn2
];
