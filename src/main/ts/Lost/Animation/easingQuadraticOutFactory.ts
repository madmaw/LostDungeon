 function easingQuadraticOutFactory(duration: number) {
    return function (t: number) {
        let st = t / duration;
        let a = 1 - st;
        return 1 - a * a;
    }
}


