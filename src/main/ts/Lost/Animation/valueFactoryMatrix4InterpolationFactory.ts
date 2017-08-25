function valueFactoryMatrix4InterpolationFactory(from: Matrix4, to: Matrix4): ValueFactory<Matrix4> {

    return function (p: number, value: Matrix4): Matrix4 {
        if (!value) {
            value = matrixIdentity4();
        }
        for (var i = 0; i < value.length; i++) {
            var vfrom = from[i];
            var vto = to[i];
            var v = vfrom + (vto - vfrom) * p;
            value[i] = v;
        }
        return value;
    }
}
