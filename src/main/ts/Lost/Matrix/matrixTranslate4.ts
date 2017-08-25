function matrixTranslate4(x: number, y: number, z: number): Matrix4 {
    return [
        1, 0, 0, 0, 
        0, 1, 0, 0, 
        0, 0, 1, 0, 
        x, y, z, 1
    ];
}