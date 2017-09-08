function easingQuadraticInFactory(duration: number): Easing {
    return function(t: number) {
        let st = t / duration;
        return st * st;
    }
}
