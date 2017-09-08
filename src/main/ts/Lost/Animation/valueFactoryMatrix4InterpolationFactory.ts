function valueFactoryMatrix4InterpolationFactory(from: Matrix4, to: Matrix4): ValueFactory<Matrix4> {

    return function(p: number, value: Matrix4): Matrix4 {
        if (!value) {
            value = matrixIdentity4();
        }
        arrayForEach(from, function (vfrom: number, i: number) {
            var vto = to[i];
            var v = vfrom + (vto - vfrom) * p;
            value[i] = v;
        });
        return value;
    }
}
