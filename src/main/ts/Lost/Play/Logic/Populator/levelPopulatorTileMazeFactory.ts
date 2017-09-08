interface PointAndDirections {
    x: number;
    y: number;
    directions: Orientation[];
    preferredIndex?: number;
}

interface DiceSymbolAndCost {
    symbol: DiceSymbol;
    cost: number;
}

function levelPopulatorTileMazeFactory(roomChance: number, bendiness: number, doorChance: number, deadendChance: number): LevelPopulator {
    return (game: Game, rng: RandomNumberGenerator, tiles: Tile[][], width: number, height: number, depth: number, features: Feature[]) => {

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

        function getRandomSymbol(maxValue: number, diceHint: number, diceType: DiceType, persistence: number): DiceSymbolAndCost {
            let categories = DICE_TYPE_HINT_SYMBOL_COSTS[diceType];
            let costs = categories[diceHint%categories.length];
            let indices: number[] = [];
            arrayForEach(costs, function (v: number, i: number) {
                if (v != nil) {
                    indices.push(i);
                }
            });
            while (persistence) { 
                let index = rng(indices.length);
                let symbol = indices[index];
                let cost = costs[symbol];
                if (cost <= maxValue) {
                    return {
                        symbol: symbol,
                        cost: cost
                    };
                }
                persistence--;
            }
        }

        function createRandomDice(maxValueCount: number, maxSideValueCount: number, diceHint: number, diceType: DiceType, ownerId?: number): Dice {

            let level = max(0, floor(sqrt(maxValueCount)) - 1);
            if (!level) {
                diceType = DICE_TYPE_NEUTRAL;
            }
            let symbols: DiceSymbol[][] = [];
            let empty: boolean = <any>1;
            countForEach(3, function (i: number) {
                let faceSymbols = [];
                let sideValueCount: number;
                if (i == 2) {
                    sideValueCount = maxValueCount;
                } else {
                    sideValueCount = rng(maxValueCount);
                }
                sideValueCount = min(maxSideValueCount, sideValueCount);
                maxValueCount -= sideValueCount;

                while (faceSymbols.length < 4 && sideValueCount > 0) {
                    let symbolAndCost = getRandomSymbol(sideValueCount, diceHint, diceType, ceil(sideValueCount));
                    empty = empty && !symbolAndCost;
                    if (symbolAndCost) {
                        sideValueCount -= symbolAndCost.cost;
                        faceSymbols.push(symbolAndCost.symbol);
                    } else {
                        break;
                    }
                }
                symbols.push(faceSymbols, faceSymbols);
            })

            if (!empty) {
                let dice: Dice = {
                    diceId: game.nextEntityId++,
                    level: level,
                    owner: ownerId,
                    symbols: symbols,
                    type: diceType
                }
                return dice;
            }
        }

        let doorCounts: { [_: string]: number } = {};
        let wallCount = width * height;
        let roomCount = rng(roomChance * wallCount);
        let buffer = 3;
        let level: AbridgedLevel = {
            tiles: tiles,
            levelWidth: width,
            levelHeight: height
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
        let floorTiles: Point[] = [];
        levelFindTile(
            level,
            function (tile: Tile, x: number, y: number) {
                let p = { x: x, y: y };
                if (countFloors(x, y) == 1) {
                    deadends.push(p);
                }
                if (tile.type == TILE_TYPE_FLOOR) {
                    floorTiles.push(p);
                }
            }
        );
        // randomize the deadends
        randomizeArray(rng, deadends);
        randomizeArray(rng, floorTiles);
        // handle any features
        arrayForEach(features, function (feature: Feature) {
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
        });
        arrayForEachReverse(deadends, function (deadend: Point) {
            let remove: boolean;
            // still a deadend?
            if (countFloors(deadend.x, deadend.y) == 1 && rng() > deadendChance) {
                // remove the deadend
                arrayForEach(ORIENTATION_DIFFS, function (diff: Point) {
                    let fromx = deadend.x + diff.x;
                    let fromy = deadend.y + diff.y;
                    let tox = deadend.x - diff.x;
                    let toy = deadend.y - diff.y;
                    if (fromx >= 0 && fromx < width && tox >= 0 && tox < width && fromy >= 0 && fromy < height && toy >= 0 && toy < height) {
                        let to = tiles[tox][toy];
                        let from = tiles[fromx][fromy];
                        if (to.type == TILE_TYPE_SOLID && from.type == TILE_TYPE_FLOOR) {
                            to.type = TILE_TYPE_FLOOR;
                            remove = <any>1;
                        }
                    }
                });
            }
            return remove;
        })

        let attackType: DiceType = rng(4);
        let defendType: DiceType = rng(4);

        // add in some monsters
        let monsterCount = max(0, depth - 2);
        monsterCount += rng(monsterCount);
        arrayForEachReverse(floorTiles, function (floorTile: Point) {
            if (monsterCount) {
                let tile = tiles[floorTile.x][floorTile.y];

                let entityLevel = rng(depth) + 1;
                let healthSlots = max(1, rng(sqrt(entityLevel >> 1)));
                let diceSlots = entityLevel - rng(entityLevel >> 1) + 1;

                let diceCount = diceSlots - rng(diceSlots >> 1);

                let dice: Dice[] = [];
                let entityId = game.nextEntityId++;
                let entityType = rng(4);
                while (diceCount) {
                    diceCount--;
                    let newDice = createRandomDice(rng(diceCount)+1, entityLevel, diceCount, entityType, entityId);
                    if (newDice) {
                        dice.push(newDice);
                    }
                }

                let entity: Entity = {
                    behaviorType: BEHAVIOR_TYPE_MONSTER,
                    dice: dice,
                    diceSlots: diceSlots,
                    resourceCounts: {},
                    entityOrientation: rng(4),
                    healthSlots: healthSlots,
                    id: entityId
                }

                tile.entity = entity;
                monsterCount--;
            }
            return <any>monsterCount;
        });

        // add in some treasures
        let treasurePileCount = sqrt(depth) + 3;
        let diceHint = 0;
        // do the deadends first, but use floor tiles if we run out
        deadends.push.apply(deadends, floorTiles);
        arrayForEach(deadends, function (deadend: Point) {
            let tile = tiles[deadend.x][deadend.y];
            let treasures = min(treasurePileCount, max(rng() * rng() * rng(depth+1), 1));
            while (treasures > 0) {
                let diceType: DiceType;
                let maxValueCount;
                let maxSideValueCount;
                if (depth < 3) {
                    // ensure an even spread early on
                    diceType = DICE_TYPE_NEUTRAL;
                    maxValueCount = 3;
                    maxSideValueCount = 1;
                } else {
                    diceHint = rng(99);
                    diceType = rng(4);
                    let maxLevel = rng(depth);
                    maxValueCount = 2 + rng(sqrt(maxLevel) + 2) + sqrt(maxLevel * 2);
                    maxSideValueCount = 1 + maxLevel;
                }
                let dice = createRandomDice(maxValueCount, maxSideValueCount, diceHint, diceType);
                diceHint++;
                if (dice) {
                    let slot = getBestAvailableTileSlotKey(TILE_SLOTS_ALL, tile, 0, 0);
                    tile.dice[slot] = {
                        dice: dice,
                        face: rng(6)
                    }
                }
                treasures--;
            }
            treasurePileCount--;

        });
    }
}
