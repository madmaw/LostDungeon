function matrixCopyInto4(from: Matrix4, into: Matrix4) {
    for( let i=0; i<16; i++ ) {
        into[i] = from[i];
    }
}
