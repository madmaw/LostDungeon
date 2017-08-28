function copyArray<T>(a: T[]): T[] {
    let result = [];
    result.push.apply(result, a);
    return result;
}
