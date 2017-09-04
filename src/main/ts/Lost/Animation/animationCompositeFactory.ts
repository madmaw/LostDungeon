function animationCompositeFactory(animations: Animation[]): Animation {

    return function (t: number): boolean {
        let count = animations.length;
        for (let i = count; i > 0;) {
            i--;
            let animation = animations[i];
            let done = animation(t);
            if (done) {
                count--;
                animations.splice(i, 1);
            }
        }
        return !count;
    }

}
