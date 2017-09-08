function matrixRotate4(x: number, y: number, z: number, rad: number): Matrix4 {
    let s, c, t;

    s = sin(rad);
    c = cos(rad);
    t = 1 - c;
    return [
        x * x * t + c, y * x * t - z * s, z * x * t - y * s, 0, 
        x * y * t + z * s, y * y * t + c, z * y * t - x * s, 0,
        x * z * t + y * s, y * z * t + x * s, z * z * t + c, 0,
        0, 0, 0, 1
    ];

    // Perform rotation-specific matrix multiplication
    /*
    out[0] = x * x * t + c;
    out[1] = y * x * t - z * s;
    out[2] = z * x * t - y * s;
    out[3] = 0;
    out[4] = x * y * t + z * s;
    out[5] = y * y * t + c;
    out[6] = z * y * t - x * s;
    out[7] = 0;
    out[8] = x * z * t + y * s;
    out[9] = y * z * t + x * s;
    out[10] = z * z * t + c;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;
    return out;
    */
}
