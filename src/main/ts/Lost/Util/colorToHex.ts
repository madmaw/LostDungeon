function colorToHex(a: number[]) {
    let hex = '#';
    arrayForEach(a, function (v: number) {
        let h = v.toString(16);
        hex += h;
    });
    return hex;
}
