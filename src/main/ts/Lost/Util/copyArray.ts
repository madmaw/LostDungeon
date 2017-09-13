function copyArray<T>(a: T[]): T[] {
    let result = [];
    arrayPushAll(result, a);
    return result;
}
