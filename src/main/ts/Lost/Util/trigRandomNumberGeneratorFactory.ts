function trigRandomNumberGeneratorFactory(seed?: number): RandomNumberGenerator {

    if (!seed) {
        seed = Math.ceil(Math.random() * 999);
    }

    return function (range?: number) {
        var x = Math.sin(seed++) * 10000;
        var r = x - Math.floor(x);
        if (range != null) {
            r = Math.floor(r * range);
        }
        return r;
    }
}
