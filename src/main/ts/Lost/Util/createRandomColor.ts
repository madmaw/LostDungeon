function createRandomColor(rng: RandomNumberGenerator, min: number, total: number): number[] {
    let x = min + rng(total - min * 3);
    let y = min + rng(total - min * 2 - x);
    let z = total - x - y;
    let a = [x, y, z];
    let i = rng(3);
    let v = a[i];
    a.splice(i, 1);
    a.push(v);

    return a;
}
