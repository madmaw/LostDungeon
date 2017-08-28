function animationTweenFactory(
    startTime: number,
    easing: Easing,
    ...effects: Effect[]
): Animation {

    return function (time: number): number {
        let dtime = time - startTime;
        let progress = easing(dtime);
        let done = 1;
        if (progress > 1) {
            progress = 1;
            done = 0;
        }
        for (let effect of effects) {
            effect(progress);
        }
        return done;
    }

}
