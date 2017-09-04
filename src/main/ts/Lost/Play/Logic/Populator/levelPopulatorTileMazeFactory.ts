interface PointAndDirections {
    x: number;
    y: number;
    directions: Orientation[];
    preferredIndex?: number;
}

function levelPopulatorTileMazeFactory(roomChance: number, bendiness: number, doorChance: number, deadendChance: number): LevelPopulator {
    return function (game: Game, rng: RandomNumberGenerator, tiles: Tile[][], width: number, height: number, depth: number, features: Feature[]) {

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
        let roomCount = rng(roomChance * wallCount);
        let buffer = 3;
        let level = {
            tiles: tiles,
            width: width,
            height: height
        };
        while (roomCount > 0) {
            // make sure we pad rooms three (two walls and a corridor) on each side so we can always fit corridors down the side, so everything connects...
            let rw = rng(width / 3) + 2;
            let rh = rng(height / 3) + 2;
            let rx = rng(width - rw - buffer);
            let ry = rng(height - rh - buffer);

            let badTile = levelFindTile(
                level,
                function (tile: Tile, x: number, y: number) {
                    return tile.type == TILE_TYPE_FLOOR && x >= rx - buffer && y >= ry - buffer && x < rx + rw + buffer && y < ry + rh + buffer;
                }
            );

            
            if (!badTile) {
                let room = '' + roomCount;
                let doorCount = rng((rw + rh) * doorChance) + 1;
                doorCounts[room] = doorCount;
                for (let x = rx; x < rx + rw; x++) {
                    for (let y = ry; y < ry + rh; y++) {
                        let tile = tiles[x][y];
                        tile.type = TILE_TYPE_FLOOR;
                        tile.name = room;
                    }
                }
            }

            roomCount--;
        }

        var startX = width - 1;
        var startY = height - 1;

        let pathSoFar: PointAndDirections[] = [{
            x: startX,
            y: startY,
            directions: copyArray(ORIENTATION_ALL)
        }];
        while (pathSoFar.length) {
            let step = pathSoFar[0];
            tiles[step.x][step.y].type = TILE_TYPE_FLOOR;
            let index;
            if (rng() > bendiness) {
                index = step.preferredIndex;
            }
            step.preferredIndex = nil;
            if (index == nil) {
                index = rng(step.directions.length);
            }
            let orientation = step.directions.splice(index, 1)[0];
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
                    directions: copyArray(ORIENTATION_ALL),
                    preferredIndex: index
                });
            }
        }

        // find all the deadends
        let deadends: Point[] = [];
        levelFindTile(
            level,
            function (tile: Tile, x: number, y: number) {
                if (countFloors(x, y) == 1) {
                    deadends.push({ x: x, y: y });
                }
            }
        );
        // randomize the deadends
        for (let i in deadends) {
            let x = rng(deadends.length);
            let tmp = deadends[x];
            deadends[x] = deadends[i];
            deadends[i] = tmp;
        }
        // handle any features
        for (var feature of features) {
            switch (feature.type) {
                case FEATURE_TYPE_ENTRANCE:
                    let point: Point;
                    if (deadends.length) {
                        point = deadends.splice(0, 1)[0];
                    } else {
                        point = {
                            x: rng(width),
                            y: rng(height)
                        }
                    }
                    let entranceTile = tiles[point.x][point.y];
                    entranceTile.type = TILE_TYPE_ROOFLESS;
                    entranceTile.name = feature.name;
                    break;
                case FEATURE_TYPE_EXIT:
                    let exitTile: Tile;
                    do {
                        exitTile = tiles[rng(width)][rng(height)];
                    } while (exitTile.type != TILE_TYPE_SOLID);
                    exitTile.type = TILE_TYPE_PIT;
                    exitTile.name = feature.name;
                    break;
            }
        }
        for (let i = deadends.length; i > 0;) {
            i--;
            let deadend = deadends[i];
            // still a deadend?
            if (countFloors(deadend.x, deadend.y) == 1 && rng() > deadendChance) {
                // remove the deadend
                for (let diff of ORIENTATION_DIFFS) {
                    let fromx = deadend.x + diff.x;
                    let fromy = deadend.y + diff.y;
                    let tox = deadend.x - diff.x;
                    let toy = deadend.y - diff.y;
                    if (fromx >= 0 && fromx < width && tox >= 0 && tox < width && fromy >= 0 && fromy < height && toy >= 0 && toy < height) {
                        let to = tiles[tox][toy];
                        let from = tiles[fromx][fromy];
                        if (to.type == TILE_TYPE_SOLID && from.type == TILE_TYPE_FLOOR) {
                            to.type = TILE_TYPE_FLOOR;
                            deadends.splice(i, 1);
                        }
                    }
                }
            }
        }
        // add in some treasures
        let treasurePileCount = depth;
        for (let deadend of deadends) {
            let tile = tiles[deadend.x][deadend.y];
            let treasures = 1;
            while (treasures > 0) {
                let symbols: DiceSymbol[][] = [];
                let level = 0;
                for (let side = 0; side < 6; side++) {
                    let sideSymbols: DiceSymbol[] = [];
                    let sideSymbolCount = rng(5);
                    if (sideSymbolCount == 4) {
                        level++;
                    }
                    while (sideSymbolCount > 0) {
                        sideSymbolCount--;
                        sideSymbols.push(rng(DICE_SYMBOL_COUNT));
                    }
                    symbols.push(sideSymbols);
                }
                let dice: Dice = {
                    diceId: game.nextEntityId++,
                    level: level,
                    symbols: symbols,
                    type: rng(4)
                };
                let slot = getBestAvailableTileSlotKey(TILE_SLOTS_ALL, tile, 0, 0);
                tile.dice[slot] = {
                    dice: dice,
                    face: rng(6)
                }
                treasures--;
            }
        }
    }
}
