interface PointAndDirections {
    x: number;
    y: number;
    directions: Orientation[];
}

function levelPopulatorTileMazeFactory(wallRemovalFraction: number, checking: number): LevelPopulator {
    return function (rng: RandomNumberGenerator, tiles: Tile[][], width: number, height: number, depth: number) {

        function countFloors(x: number, y: number, decrementDoors?: number) {
            return countSurroundingTiles(tiles, width, height, x, y, function (tile: Tile) {
                let doorCount = doorCounts[tile.name];
                if (decrementDoors && doorCount) {
                    doorCounts[tile.name]--;
                }
                return tile.type == TILE_TYPE_FLOOR && !doorCount ?
                    1 : 0;
            });
        }
        let doorCounts: { [_: string]: number } = {};
        let wallCount = width * height;
        let roomCount = rng(wallRemovalFraction * wallCount);
        while (roomCount > 0) {
            let rw = rng(width / 3) + 1;
            let rh = rng(height / 3) + 1;
            let rx = rng(width - rw);
            let ry = rng(height - rh);

            let room = '' + roomCount;
            let doorCount = Math.max(1, rng(rw) - rng(rh) + 2);
            doorCounts[room] = doorCount;
            o: for (let x = rx; x < rx + rw; x++) {
                for (let y = ry; y < ry + rh; y++) {
                    let tile = tiles[x][y];
                    if (tile.name) {
                        // immediately break out!
                        break o;
                    }
                    tile.type = TILE_TYPE_FLOOR;
                    tile.name = room;
                }
            }
            roomCount--;
        }

        let checks = checking;
        while (checks) {
            checks--;

            var startX = rng(width);
            var startY = rng(height);

            if (countFloors(startX, startY) < 2) {

                // reset the door counts if required so we can have connectivity
                for (var i in doorCounts) {
                    if (!doorCounts[i]) {
                        doorCounts[i] = 1;
                    }
                }

                let pathSoFar: PointAndDirections[] = [{
                    x: startX,
                    y: startY,
                    directions: copyArray(ORIENTATION_ALL)
                }];
                while (pathSoFar.length) {
                    let step = pathSoFar[0];
                    tiles[step.x][step.y].type = TILE_TYPE_FLOOR;
                    let orientation = step.directions.splice(rng(step.directions.length), 1)[0];
                    if (!step.directions.length) {
                        pathSoFar.splice(0, 1);
                    }
  
                    let delta = ORIENTATION_DIFFS[orientation];
                    let tx = step.x + delta.x;
                    let ty = step.y + delta.y;
                    if (tx >= 0 && tx < width && ty >= 0 && ty < height && countFloors(tx, ty) < 2) {
                        // if we've got through on a door, we need to decrement those doors
                        countFloors(tx, ty, 1);

                        pathSoFar.splice(0, 0, {
                            x: tx,
                            y: ty,
                            directions: copyArray(ORIENTATION_ALL)
                        });
                    }
                }

            }

        }

    }
}
