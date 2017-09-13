type ResourceType = number;

let RESOURCE_TYPE_FIRE = DICE_TYPE_FIRE;
let RESOURCE_TYPE_WATER = DICE_TYPE_WATER;
let RESOURCE_TYPE_LIFE = DICE_TYPE_LIFE;

let RESOURCE_TYPE_ALL = [
    RESOURCE_TYPE_FIRE,
    RESOURCE_TYPE_WATER,
    RESOURCE_TYPE_LIFE
];


function zeroResourceMap(): { [_: number]: number } {
    return {
        // fire
        1: 0,
        // water
        2: 0,
        // life
        3: 0
    };
}
