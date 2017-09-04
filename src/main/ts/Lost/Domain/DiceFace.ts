type DiceFace = number;

let DICE_FACE_FRONT: DiceFace = 0;
let DICE_FACE_BACK: DiceFace = 1;
let DICE_FACE_TOP: DiceFace = 2;
let DICE_FACE_BOTTOM: DiceFace = 3;
let DICE_FACE_RIGHT: DiceFace = 4;
let DICE_FACE_LEFT: DiceFace = 5;

interface AxisAndAngleAndMatrix {
    axisX: number;
    axisY: number;
    axisZ: number;
    radians: number;
    matrix: Matrix4
}

function newAxisAndAngleAndMatrix(axisX: number, axisY: number, axisZ: number, radians: number): AxisAndAngleAndMatrix {
    return {
        axisX: axisX,
        axisY: axisY,
        axisZ: axisZ,
        radians: radians,
        matrix: matrixRotate4(axisX, axisY, axisZ, radians)
    }
}

let DICE_FACE_ROTATIONS: AxisAndAngleAndMatrix[] = [
    //matrixRotateX4(-pi / 2),
    newAxisAndAngleAndMatrix(1, 0, 0, -piOn2),
    //matrixRotateX4(pi / 2),
    newAxisAndAngleAndMatrix(1, 0, 0, piOn2),
    //matrixIdentity4(),
    newAxisAndAngleAndMatrix(0, 1, 0, 0),
    //matrixRotateX4(pi),
    newAxisAndAngleAndMatrix(0, 1, 0, pi),
    //matrixRotateZ4(pi / 2),
    newAxisAndAngleAndMatrix(0, 0, 1, piOn2),
    //matrixRotateZ4(-pi / 2)
    newAxisAndAngleAndMatrix(0, 0, 1, piOn2)
];


