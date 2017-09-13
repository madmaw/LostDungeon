interface WallColors {
    grout: string;
    wallUpper: string;
    wallLower: string;
    floor: string;
}

function createRandomWallColors(rng: RandomNumberGenerator): WallColors {

    let wallLower = createRandomColor(rng, 3, 12);
    let d = 3 - max(abs(wallLower[1] - wallLower[0]), abs(wallLower[2] - wallLower[0]), abs(wallLower[2] - wallLower[1]));
    let wallUpper = createRandomColor(rng, 6, 18 + rng(d));
    let floor = [];
    let grout = [];
    let up = rng(2);

    let i = rng(2);
    if (i) {
        let tmp = wallUpper;
        wallUpper = wallLower;
        wallLower = tmp;
    }

    for (let i = 0; i < 3; i++) {
        arrayPush(floor, ceil((wallUpper[i] + wallLower[i]) / 2 + up));
        arrayPush(grout, max(0, min(wallUpper[i], wallLower[i]) - 3));
    }

    //let v = grout.splice(i, 1)[0];
    //grout.push(v);

    return {
        wallLower: colorToHex(wallLower),
        wallUpper: colorToHex(wallUpper),
        grout: colorToHex(grout),
        floor: colorToHex(floor)
    };
}
