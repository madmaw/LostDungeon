type Orientation = number;

var ORIENTATION_NORTH : Orientation = 0;
var ORIENTATION_EAST : Orientation = 1;
var ORIENTATION_SOUTH: Orientation = 2;
var ORIENTATION_WEST: Orientation = 3;

var ORIENTATION_ALL: Orientation[] = [ORIENTATION_NORTH, ORIENTATION_EAST, ORIENTATION_SOUTH, ORIENTATION_WEST];


var ORIENTATION_DIFFS: Point[] = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 }
];
var ORIENTATION_DIFFS_CORNERS: Point[] = copyArray(ORIENTATION_DIFFS);
ORIENTATION_DIFFS_CORNERS.push(
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: -1, y: 1 },
    { x: 1, y: 1 }
);

var ORIENTATION_ANGLES: number[] = [0, -piOn2, pi, piOn2];
