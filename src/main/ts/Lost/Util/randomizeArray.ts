function randomizeArray<A>(rng: RandomNumberGenerator, a: A[]) {
    arrayForEach(a, function (v: A, i: number) {
        let x = rng(a.length);
        let tmp = a[x];
        a[x] = a[i];
        a[i] = tmp;
    });

}
