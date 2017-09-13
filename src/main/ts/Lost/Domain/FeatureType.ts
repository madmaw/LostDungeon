interface TwoToneColors {
    upper: string;
    lower: string;
}

type FeatureType = number;

let FEATURE_TYPE_NONE: FeatureType = 0;
let FEATURE_TYPE_BONUS_DICE_SLOT: FeatureType = 1;
let FEATURE_TYPE_BONUS_HEALTH: FeatureType = 2;

let FEATURE_TYPE_ALL = [
    FEATURE_TYPE_NONE,
    FEATURE_TYPE_BONUS_DICE_SLOT,
    FEATURE_TYPE_BONUS_HEALTH
];

let FEATURE_TYPE_COUNT = 3;

let FEATURE_TYPE_NAMES = [
    nil,
    '!',
    '♥'
]

let FEATURE_TYPE_COLORS: TwoToneColors[] = [
    nil,
    {
        upper: '#0f0',
        lower: '#afa'
    },
    {
        upper: '#f6c',
        lower: '#f00'
    }
];

let FEATURE_TYPE_SCRIBBLES: string[][] = [
    nil,
    ['carry', 'more'],
    ['health', 'up']
];
