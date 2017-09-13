
let easingQuadraticInFactory: (duration: number) => Easing;
if (FEATURE_MULTIPLE_EASING) {
    easingQuadraticInFactory = function (duration: number): Easing {
        return function (t: number) {
            let st = t / duration;
            return st * st;
        }
    }
} else {
    easingQuadraticInFactory = easingQuadraticOutFactory;
}


