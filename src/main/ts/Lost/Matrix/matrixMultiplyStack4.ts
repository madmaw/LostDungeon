function matrixMultiplyStack4(matrices: Matrix4[]): Matrix4 {
    let current = matrixIdentity4();
    for (let matrix of matrices) {
        current = matrixMultiply4(current, matrix);
    }
    return current;
}