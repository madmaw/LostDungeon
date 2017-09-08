function arrayPushAll<A>(into: A[], values: A[]) {
    into.push.apply(into, values);
}
