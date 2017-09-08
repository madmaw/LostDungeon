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

let DICE_SYMBOL_RESOURCE_VALUES: { [_: number]: { [_: number]: number } } = {
    // fire
    2: {
        // fire
        1: 1
    },
    // water
    3: {
        // water
        2: 1
    },
    // life
    4: {
        // life
        3: 1
    }
}

let DICE_TYPE_HINT_SYMBOL_COSTS: {
    [_: number]: number[][]
} = {
        // neutral
        0: [
            // attack
            [1, nil, nil, nil, nil],
            // defend
            [nil, 1, nil, nil, nil],
            // resource (fire)
            [nil, nil, 1, nil, nil],
            // resource (water)
            [nil, nil, nil, 1, nil],
            // resource (life)
            [nil, nil, nil, nil, 1],
            // resource (multi)
            [nil, nil, .8, .8, .8]

        ],
        // fire
        1: [
            // attack
            [.75, nil, 0, nil, nil],
            // resource
            [nil, nil, .5, nil, nil]
        ],
        // water
        2: [
            // defend
            [nil, .7, nil, .6, nil],
            // resource
            [nil, nil, nil, .6, nil]
        ],
        // life
        3: [
            // attack
            [.8, nil, nil, nil, nil],
            // defend
            [nil, .8, nil, nil, .6],
            // resource
            [nil, nil, nil, nil, .6]
        ]
    };
