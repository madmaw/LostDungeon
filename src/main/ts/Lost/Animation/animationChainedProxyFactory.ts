function animationChainedProxyFactory(
    originalAnimation: Animation,
    nextAnimationFactory: (t: number) => void | Animation
): Animation {
    let animation = originalAnimation;
    return function(t: number, forceEnd: boolean): boolean {
        let done = animation(t, forceEnd);
        if (done && nextAnimationFactory) {
            animation = <Animation>nextAnimationFactory(t);
            nextAnimationFactory = nil;
            if (animation) {
                if (forceEnd) {
                    animation(0, forceEnd);
                } else {
                    done = <any>0;
                }
            }
        }
        return done;
    }
}
