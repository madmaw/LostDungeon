function animationChainedProxyFactory<T>(
    originalAnimation: Animation,
    nextAnimationFactory: (t: number, param?: T) => void | Animation,
    param?: T
): Animation {
    let animation = originalAnimation;
    return function (t: number): boolean {
        let done = animation(t);
        if (done && nextAnimationFactory) {
            animation = <Animation>nextAnimationFactory(t, param);
            nextAnimationFactory = nil;
            if (animation) {
                done = <any>0;
            }
        }
        return done;
    }
}
