function create2DArray<A>(width: number, height: number, fillFunction: (x?: number, y?: number) => A): A[][] {
    let array: A[][] = [];
    for (let x = 0; x < width; x++) {
        let column: A[] = [];
        for (let y = 0; y < height; y++) {
            column.push(fillFunction(x, y));
        }
        array.push(column);
    }
    return array;
}
