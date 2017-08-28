function colorToHex(a: number[]) {
    let hex = '#';
    for (let v of a) {
        let h = v.toString(16);
        hex += h;
    }
    return hex;
}
