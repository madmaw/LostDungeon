function animationCompositeFactory(animations: Animation[]): Animation {

    return function (t: number): number {
        let count = animations.length;
        for (let i = count; i > 0;) {
            i--;
            let animation = animations[i];
            let running = animation(t);
            if (!running) {
                count--;
                animations.splice(i, 1);
            }
        }
        return count;
    }

}
