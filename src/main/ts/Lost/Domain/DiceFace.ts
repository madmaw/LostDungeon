type DiceFace = number;

let DICE_FACE_FRONT: DiceFace = 0;
let DICE_FACE_BACK: DiceFace = 1;
let DICE_FACE_TOP: DiceFace = 2;
let DICE_FACE_BOTTOM: DiceFace = 3;
let DICE_FACE_RIGHT: DiceFace = 4;
let DICE_FACE_LEFT: DiceFace = 5;

let DICE_FACE_ROTATIONS: Matrix4[] = [
    matrixRotateX4(-pi / 2),
    matrixRotateX4(pi / 2),
    matrixIdentity4(),
    matrixRotateX4(pi),
    matrixRotateZ4(pi / 2),
    matrixRotateZ4(-pi / 2)
];


