function trigRandomNumberGeneratorFactory(seed?: number): RandomNumberGenerator {

    if (!seed) {
        seed = ceil(random() * 999);
    }

    return function (range?: number) {
        var x = sin(seed++) * 10000;
        var r = ceil(x) - x;
        if (range != null) {
            r = floor(r * range);
        }
        return r;
    }
}
