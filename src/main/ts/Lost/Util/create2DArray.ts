function create2DArray<A>(width: number, height: number, fillFunction: (x?: number, y?: number, a?: A[][]) => A): A[][] {
    let array: A[][] = [];
    for (let x = 0; x < width; x++) {
        let column: A[] = [];
        for (let y = 0; y < height; y++) {
            arrayPush(column, fillFunction(x, y, array));
        }
        arrayPush(array, column);
    }
    return array;
}
