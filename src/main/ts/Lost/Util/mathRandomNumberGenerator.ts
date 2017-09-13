function mathRandomNumberGenerator(range?: number): number {
    let result = random();
    if (range != nil) {
        result = floor(result * range);
    }
    return result;
}
