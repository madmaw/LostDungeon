function randomizeArray<A>(rng: RandomNumberGenerator, a: A[], chance?:number) {
    arrayForEach(a, function (v: A, i: number) {
        if (chance == nil || rng() < chance ) {
            let x = rng(a.length);
            let tmp = a[x];
            a[x] = a[i];
            a[i] = tmp;
        }
    });

}
