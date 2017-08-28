interface WallColors {
    grout: string;
    wallUpper: string;
    wallLower: string;
    floor: string;
}

function createRandomWallColors(rng: RandomNumberGenerator): WallColors {

    let wallLower = createRandomColor(rng, 3, 12);
    let d = 3 - Math.max(Math.abs(wallLower[1] - wallLower[0]), Math.abs(wallLower[2] - wallLower[0]), Math.abs(wallLower[2] - wallLower[1]));
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
        floor.push(Math.ceil((wallUpper[i] + wallLower[i]) / 2 + up));
        grout.push(Math.max(0, Math.min(wallUpper[i], wallLower[i]) - 3));
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
