function valueFactoryMatrix4RotationFactory(aroundX: number, aroundY: number, aroundZ: number, fromAngle: number, toAngle: number) {
    return function(p: number, value: Matrix4): Matrix4 {
        if (!value) {
            value = matrixIdentity4();
        }
        let angle = fromAngle + (toAngle - fromAngle) * p;
        matrixCopyInto4(matrixRotate4(aroundX, aroundY, aroundZ, angle), value);
        return value;
        
    }
}
