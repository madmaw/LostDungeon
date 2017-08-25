function matrixRotateY4(radians: number): Matrix4 {
    let c = Math.cos(radians);
    let s = Math.sin(radians);
    return [
        c, 0,-s, 0, 
        0, 1, 0, 0, 
        s, 0, c, 0,
        0, 0, 0, 1
    ];
}
