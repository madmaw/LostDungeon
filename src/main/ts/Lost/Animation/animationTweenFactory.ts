function animationTweenFactory(
    startTime: number,
    easing: Easing,
    ...effects: Effect[]
): Animation {

    return function (time: number): boolean {
        let dtime = time - startTime;
        let progress = easing(dtime);
        let done = progress >= 1;
        if (done) {
            progress = 1;
        }
        for (let effect of effects) {
            effect(progress);
        }
        return done;
    }

}
