function arrayForEachReverse<A>(a: A[], f: (a: A, i: number) => boolean | void): boolean {
    for (var i = a.length; i > 0;) {
        i--;
        let v = a[i];
        if (f(v, i)) {
            arraySplice(a, i, 1);
        }
    }
    return !a.length;
}
