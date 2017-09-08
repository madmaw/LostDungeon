function animationTweenFactory(
    startTime: number,
    duration: number,
    easing: Easing,
    effects: Effect[]
): Animation {

    return function(time: number, forceEnd: boolean): boolean {
        let dtime = time - startTime;
        if (forceEnd || dtime >= duration) {
            dtime = duration;
        }
        let done = dtime >= duration;
        let progress = easing(dtime);
        arrayForEach(effects, function (effect: Effect) {
            effect(progress);
        });
        return done;
    }

}
