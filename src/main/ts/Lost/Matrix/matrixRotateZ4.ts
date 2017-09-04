function matrixRotateZ4(radians: number): Matrix4 {
    /*
    let c = cos(radians);
    let s = sin(radians);
    return [
        c,-s, 0, 0,
        s, c, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ];
    */
    return matrixRotate4(0, 0, 1, radians);
    
}
