function animationTweenFactory(
    startTime: number,
    easing: Easing,
    effects: Effect[]
): Animation {

    return function (time: number): boolean {
        let dtime = time - startTime;
        let progress = easing(dtime);
        let done: boolean;
        if (progress > 1) {
            progress = 1;
            done = <any>1;
        }
        for (let effect of effects) {
            effect(progress);
        }
        return done;
    }

}
