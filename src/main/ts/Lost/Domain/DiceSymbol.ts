type DiceSymbol = number;

let DICE_SYMBOL_ATTACK: DiceSymbol = 0;
let DICE_SYMBOL_RESOURCE_FIRE: DiceSymbol = 1;
let DICE_SYMBOL_RESOURCE_WATER: DiceSymbol = 2;
let DICE_SYMBOL_RESOURCE_LIFE: DiceSymbol = 3;
let DICE_SYMBOL_DEFEND: DiceSymbol = 4;

let DICE_SYMBOL_COUNT = 5;

let DICE_SYMBOL_CHARACTERS: string[] = [
    '†',
    '●',
    '●',
    '●',
    '♥',
    '○',
    '○',
    '○',
];
let DICE_SYMBOL_COLORS: string[] = [
    '#000',
    '#800',
    '#008',
    '#080',
    '#000',
    '#800',
    '#008',
    '#080',
];
let DICE_SYMBOL_ROTATION: number[] = [
    0,
    -piOn2,
    -piOn2,
    -piOn2,
    piOn2,
    -piOn2,
    -piOn2,
    -piOn2,
];

let DICE_SYMBOL_PLAY_DESIRABILITY: number[] = [
    1,
    .1,
    .1,
    .1,
    1,
    .1,
    .1,
    .1
]

let DICE_SYMBOL_COLLECT_DESIRABILITY: number[] = [
    0,
    1,
    1,
    1,
    0,
    .2,
    .2,
    .2
]


let DICE_SYMBOL_OFFENSIVENESS: number[] = [
    5,
    -1,
    -1,
    -1,
    -5,
    1,
    1,
    1
]

let DICE_SYMBOL_RESOURCE_VALUES: { [_: number]: { [_: number]: number } } = {
    // fire
    1: {
        // fire
        1: 1,
        // negate fire
        5: -1
    },
    // water
    2: {
        // water
        2: 1,
        // negate water
        6: -1
    },
    // life
    3: {
        // life
        3: 1,
        // negate life
        7: -1
    }
}

function isSymbolResource(symbol: DiceSymbol): boolean {
    return <any>DICE_SYMBOL_RESOURCE_VALUES[symbol];
}

let pickUpToPlay: string[] = ['pick', 'up', 'to', 'play', '', 'dice'];
function copySentenceAndSetWord(word: string) {
    let result = copyArray(pickUpToPlay)
    result[4] = word;
    return result;
}

let NEUTRAL_DICE_HINT_SCRIBBLES: string[][] = [
    copySentenceAndSetWord('big'),
    copySentenceAndSetWord('red'),
    copySentenceAndSetWord('blue'),
    copySentenceAndSetWord('green'),
    ['drop', 'to', 'defend', '', 'look', 'down', 'to', 'drop'],
    ['DANGER', 'do', 'NOT', 'step', 'on!', '', 'throw', 'to', 'attack']
]

let DICE_TYPE_HINT_SYMBOL_COSTS: {
    [_: number]: number[][]
} = {
        // neutral
        0: [
            // resource (multi)
            [nil, .7, .7, .7],
            // resource (fire)
            [nil, .8],
            // resource (water)
            [nil, nil, .8],
            // resource (life)
            [nil, nil, nil, .8],
            // defend
            [nil, nil, nil, nil, 1],
            // attack
            [1],

        ],
        // fire
        1: [
            // attack
            [.75, 0, nil, nil, nil, nil, nil, .1],
            // resource
            [nil, .5, nil, nil, nil, nil, nil, -.1]
        ],
        // water
        2: [
            // attack
            [1, nil, nil, nil, nil, .3],
            // defend
            [nil, nil, .5, nil, .7, -.1],
            // resource
            [nil, nil, .6]
        ],
        // life
        3: [
            // attack
            [.8, nil, nil, nil, nil, nil, .1],
            // defend
            [nil, nil, nil, .6, .8, nil, -.1],
            // resource
            [nil, nil, nil, .6, nil, nil, -.1]
        ]
    };
