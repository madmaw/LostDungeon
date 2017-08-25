function easingLinearFactory(scale: number): Easing {
    return function (t: number) {
        return t * scale;
    }
}
