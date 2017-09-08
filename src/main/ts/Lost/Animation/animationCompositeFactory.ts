function animationCompositeFactory(animations: Animation[]): Animation {

    return function(t: number, forceEnd: boolean): boolean {
        return arrayForEachReverse(animations, function (animation: Animation) {
            let done = animation(t, forceEnd);
            return done;
        });
    }

}
