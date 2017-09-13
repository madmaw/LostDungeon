let easingLinearFactory: (duration: number) => Easing;
if (FEATURE_MULTIPLE_EASING) {
    easingLinearFactory = function (duration: number): Easing {
        return function (t: number) {
            return t / duration;
        }
    };
} else {
    easingLinearFactory = easingQuadraticOutFactory;
}
