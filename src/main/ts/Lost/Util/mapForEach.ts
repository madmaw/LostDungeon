function mapForEach<T>(map: { [_: string]: T }, f: (key: string, t: T) => void) {
    for (let key in map) {
        let value = map[key];
        f(key, value);
    }
}
