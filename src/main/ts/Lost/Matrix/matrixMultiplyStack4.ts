function matrixMultiplyStack4(matrices: Matrix4[]): Matrix4 {
    let current = matrixIdentity4();
    arrayForEach(matrices, function (matrix: Matrix4) {
        current = matrixMultiply4(current, matrix);
    });
    return current;
}
