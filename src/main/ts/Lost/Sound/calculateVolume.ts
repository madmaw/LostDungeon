function calculateVolume(listenerTransformStack: Matrix4[], soundTransformStack: Matrix4[]) {
    let listenerTransform = matrixMultiplyStack4(listenerTransformStack);
    let soundTransform = matrixMultiplyStack4(soundTransformStack);
    let listenerLocation = vectorTransform3Matrix4(0, 0, 0, listenerTransform);
    let soundLocation = vectorTransform3Matrix4(0, 0, 0, soundTransform);

    let dx = soundLocation[0] - listenerLocation[0];
    let dy = soundLocation[1] - listenerLocation[1];
    let dz = soundLocation[2] - listenerLocation[2];

    let distanceSquared = dx * dx + dy * dy + dz * dz;

    return 1 / (distanceSquared/3+1);
}
