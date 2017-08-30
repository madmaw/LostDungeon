function animationChainedProxyFactory<T>(
    originalAnimation: Animation,
    nextAnimationFactory: (t: number, param?: T) => Animation,
    param?: T
): Animation {
    let animation = originalAnimation;
    return function (t: number): number {
        let running = animation(t);
        if (!running && nextAnimationFactory) {
            animation = nextAnimationFactory(t, param);
            nextAnimationFactory = nil;
            if (animation) {
                running = 1;
            }
        }
        return running;
    }
}
