function matrixRotateX4(radians: number): Matrix4 {
    let c = Math.cos(radians);
    let s = Math.sin(radians);
    return [
        1, 0, 0, 0, 
        0, c,-s, 0, 
        0, s, c, 0,
        0, 0, 0, 1
    ];
}