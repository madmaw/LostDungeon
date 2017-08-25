function animationCompositeFactory(animations: Animation[]): Animation {

    return function (t: number): boolean {
        for (let i = animations.length; i > 0;) {
            i--;
            let animation = animations[i];
            let done = animation(t);
            if (done) {
                animations.splice(i, 1);
            }
        }
        return !animations.length;
    }

}
