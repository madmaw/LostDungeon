function easingLinearFactory(duration: number): Easing {
    return function(t: number) {
        return t / duration;
    }
}
