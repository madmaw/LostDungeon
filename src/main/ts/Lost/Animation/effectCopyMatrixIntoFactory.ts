function effectCopyMatrixIntoFactory(target: Matrix4, valueFactory: ValueFactory<Matrix4>): Effect {
    return function (p: number) {
        let value = valueFactory(p, target);
        matrixCopyInto4(value, target);
    }
}
