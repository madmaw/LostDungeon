function easingQuadraticFactory(scale: number): Easing {
    return function (t: number) {
        let st = t * scale;
        return st * st;
    }
}
