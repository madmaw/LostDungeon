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
    return (game: Game, rng: RandomNumberGenerator, tiles: Tile[][], width: number, height: number, depth: number, tileDefinition: TileDefinition[]) => {

        function countFloors(x: number, y: number, decrementDoors?: number) {
            return countSurroundingTiles(tiles, width, height, x, y, function (tile: Tile) {
                let doorCount = doorCounts[tile.tileName];
                if (decrementDoors && doorCount) {
                    doorCounts[tile.tileName]--;
                }
                return tile.tileType == TILE_TYPE_FLOOR && !doorCount ?
                    1 : 0;
            });
        }

        function getRandomSymbol(maxValue: number, diceHint: number, diceType: DiceType, persistence: number, preferredResourceTypeHint?: ResourceType): DiceSymbolAndCost {
            let categories = DICE_TYPE_HINT_SYMBOL_COSTS[diceType];
            let costs = categories[diceHint%categories.length];
            let indices: number[] = [];
            arrayForEach(costs, function (v: number, i: number) {
                if (v != nil) {
                    arrayPush(indices, i);
                }
            });
            let result: DiceSymbolAndCost;
            while (persistence) { 
                let index = rng(indices.length);
                let symbol = indices[index];
                let cost = costs[symbol];
                if (cost <= maxValue && (!result || result.cost < cost )) {
                    if (!diceType && preferredResourceTypeHint && isSymbolResource(symbol) && symbol != preferredResourceTypeHint) {
                        // make it into a non-resource type
                        symbol = DICE_SYMBOL_ATTACK;
                    }
                    result = {
                        symbol: symbol,
                        cost: cost
                    };
                }
                persistence--;
            }
            return result;
        }

        function getDiceLevel(valueCount: number) {
            return max(0, floor((valueCount - .4) / 2 - depth * .1));
        }

        function createRandomDice(maxValueCount: number, maxSideValueCount: number, diceHint: number, diceType: DiceType, ownerId?: number): Dice {

            let maxLevel = getDiceLevel(maxValueCount);
            let preferredResourceType: ResourceType;
            if (!maxLevel) {
                preferredResourceType = diceType;
                diceType = DICE_TYPE_NEUTRAL;
            }
            let symbols: DiceSymbol[][] = [];
            let empty: boolean = <any>1;
            let totalValueCount = 0;
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
                totalValueCount += sideValueCount;

                while (faceSymbols.length < 4 && sideValueCount > 0) {
                    let symbolAndCost = getRandomSymbol(sideValueCount, diceHint, diceType, ceil(sideValueCount * 2), preferredResourceType);
                    empty = empty && !symbolAndCost;
                    if (symbolAndCost) {
                        sideValueCount -= symbolAndCost.cost;
                        arrayPush(faceSymbols, symbolAndCost.symbol);
                    } else {
                        break;
                    }
                }
                arrayPushAll(symbols, [faceSymbols, faceSymbols]);
            })
            let level = getDiceLevel(totalValueCount);
            if (!empty) {
                let dice: Dice = {
                    diceId: game.nextEntityId++,
                    diceLevel: level,
                    owner: ownerId,
                    symbols: symbols,
                    diceType: diceType
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
                    return tile.tileType == TILE_TYPE_FLOOR && x >= rx - buffer && y >= ry - buffer && x < rx + rw + buffer && y < ry + rh + buffer;
                }
            );

            
            if (!badTile) {
                let room = '' + roomCount;
                let doorCount = rng((rw + rh) * doorChance) + 1;
                doorCounts[room] = doorCount;
                for (let x = rx; x < rx + rw; x++) {
                    for (let y = ry; y < ry + rh; y++) {
                        let tile = tiles[x][y];
                        tile.tileType = TILE_TYPE_FLOOR;
                        tile.tileName = room;
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
            tiles[step.x][step.y].tileType = TILE_TYPE_FLOOR;
            let index;
            if (rng() > bendiness) {
                index = step.preferredIndex;
            }
            step.preferredIndex = nil;
            if (index == nil) {
                index = rng(step.directions.length);
            }
            let orientation = arraySplice(step.directions, index, 1)[0];
            if (!step.directions.length) {
                arraySplice(pathSoFar, 0, 1);
            }
  
            let delta = ORIENTATION_DIFFS[orientation];
            let tx = step.x + delta.x;
            let ty = step.y + delta.y;
            if (tx >= 0 && tx < width && ty >= 0 && ty < height && countFloors(tx, ty) < 2) {
                // if we've got through on a door, we need to decrement those doors
                countFloors(tx, ty, 1);

                arraySplice(pathSoFar, 0, 0, <PointAndDirections>{
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
                    arrayPush(deadends, p);
                }
                if (tile.tileType == TILE_TYPE_FLOOR) {
                    arrayPush(floorTiles, p);
                }
            }
        );
        // randomize the deadends
        randomizeArray(rng, deadends);
        randomizeArray(rng, floorTiles);
        // handle any features
        arrayForEach(tileDefinition, function (tileDefinition: TileDefinition) {
            let tile: Tile;
            switch (tileDefinition.tileType) {
                case TILE_TYPE_PIT:
                    {
                        let tileX;
                        let tileY;
                        do {
                            tileX = rng(width);
                            tileY = rng(height);
                            tile = tiles[tileX][tileY];
                        } while (tile.tileType != TILE_TYPE_SOLID || !countFloors(tileX, tileY));
                    }   
                    break;
                default:
                    {
                        let tileX: number;
                        let tileY: number;
                        if (deadends.length) {
                            let point = arraySplice(deadends, 0, 1)[0];
                            tileX = point.x;
                            tileY = point.y;
                        } else {
                            tileX = rng(width);
                            tileY = rng(height)
                        }
                        tile = tiles[tileX][tileY];
                    }
                    break;
            }
            tile.tileType = tileDefinition.tileType;
            tile.tileName = tileDefinition.tileName;
            tile.featureType = tileDefinition.featureType;
            tile.scribbles = tileDefinition.scribbles;
            if (tileDefinition.boss) {
                // create a horrible monster
                let bossDice: Dice[] = [];
                let bossId = game.nextEntityId++;
                mapForEach(DICE_TYPE_HINT_SYMBOL_COSTS, function (diceType: string, hintsToCosts: { [_: number]: number[] }) {
                    mapForEach(hintsToCosts, function (hint: string, costs: number[]) {
                        let maxValueCount;
                        if (diceType == <any>DICE_TYPE_NEUTRAL) {
                            maxValueCount = 6;
                        } else {
                            maxValueCount = 30;
                        }
                        let dice = createRandomDice(maxValueCount, 100, <any>hint, <any>diceType, bossId)
                        dice.diceLevel = max(0, dice.diceLevel - 1);
                        arrayPush(bossDice, dice);
                    });
                });

                let boss: Entity = {
                    id: bossId,
                    behaviorType: BEHAVIOR_TYPE_MONSTER,
                    diceSlots: bossDice.length,
                    dice: bossDice,
                    healthSlots: 4,
                    personality: {
                        collectDiceSymbolWeights: DICE_SYMBOL_COLLECT_DESIRABILITY,
                        playDiceSymbolWeights: DICE_SYMBOL_PLAY_DESIRABILITY, 
                        randomness: 0
                    },
                    entityOrientation: ORIENTATION_EAST,
                    resourceCounts: zeroResourceMap(),
                    entityType: ENTITY_TYPE_BOSS
                }
                tile.entity = boss;
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
                        if (to.tileType == TILE_TYPE_SOLID && from.tileType == TILE_TYPE_FLOOR) {
                            to.tileType = TILE_TYPE_FLOOR;
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
        let monsterCount = max(0, depth - 1);
        monsterCount += rng(sqrt(monsterCount));
        arrayForEachReverse(floorTiles, function (floorTile: Point) {
            if (monsterCount) {
                let tile = tiles[floorTile.x][floorTile.y];
                if (!tile.entity) {
                    let entityLevel = rng(depth - 1) + 1;
                    let healthSlots = floor(sqrt(entityLevel));
                    let diceSlots = entityLevel - rng(entityLevel >> 1) + 1;

                    let diceCount = diceSlots - rng(diceSlots >> 1);


                    let collectDiceSymbolWeights: number[] = [];
                    let playDiceSymbolWeights: number[] = [];
                    arrayForEach(DICE_SYMBOL_PLAY_DESIRABILITY, function (baseDesirability: number, index: number) {
                        arrayPush(playDiceSymbolWeights, baseDesirability + baseDesirability * rng())
                        arrayPush(collectDiceSymbolWeights, DICE_SYMBOL_COLLECT_DESIRABILITY[index] + rng()/2)
                    });

                    let dice: Dice[] = [];
                    let entityId = game.nextEntityId++;
                    let entityType: DiceType;
                    let diceHintOffset;
                    let scribbles: string[];
                    if (depth <= 2) {
                        // should just get resource dice
                        diceCount = 3;
                        diceHintOffset = 0;
                        entityType = DICE_TYPE_NEUTRAL;
                        scribbles = ['throw', 'attack', 'die'];
                    } else {
                        if (diceCount > 3) {
                            diceHintOffset = rng(diceCount);
                        } else {
                            diceHintOffset = 4;
                        }
                        entityType = rng(4)
                    }

                    let hasLeveledDice: boolean;
                    let hasResourceDice: boolean;
                    while (diceCount) {
                        diceCount--;
                        let diceHint = diceHintOffset + diceCount;
                        let maxValueCount = rng(diceCount * 1.7) + 2;
                        let maxDiceSideValue = max(1, getDiceLevel(maxValueCount) + floor(sqrt(depth)-1));
                        let newDice = createRandomDice(maxValueCount, maxDiceSideValue, diceHint, entityType, entityId);
                        hasLeveledDice = hasLeveledDice || <any>newDice.diceLevel;

                        // increase the appeal of rerolling if the level is high and the dice has a type
                        if (newDice.diceLevel && newDice.diceType) {
                            collectDiceSymbolWeights[newDice.diceType] += newDice.diceLevel * .4;
                        }

                        if (newDice) {
                            arrayPush(dice, newDice);
                        }
                    }
                    if (hasLeveledDice && !hasResourceDice) {
                        diceSlots++;
                        let resourceDice = createRandomDice(2.4, 2, entityType, DICE_TYPE_NEUTRAL, entityId);
                        arrayPush(dice, resourceDice);
                    }


                    let entity: Entity = {
                        behaviorType: BEHAVIOR_TYPE_MONSTER,
                        dice: dice,
                        // always have a free slot
                        diceSlots: diceSlots + 1,
                        resourceCounts: zeroResourceMap(),
                        entityOrientation: rng(4),
                        healthSlots: healthSlots,
                        id: entityId,
                        personality: {
                            collectDiceSymbolWeights: collectDiceSymbolWeights,
                            playDiceSymbolWeights: playDiceSymbolWeights,
                            randomness: rng() / depth,
                        },
                        entityType: ENTITY_TYPE_MONSTER
                    }

                    tile.entity = entity;
                    tile.scribbles = scribbles;
                    monsterCount--;
                }
            }
            return <any>monsterCount;
        });

        let secretCount = min(rng(2), deadends.length);
        // add in some treasures
        let treasurePileCount = rng(sqrt(depth)) + 3;
        let diceHint = 3 + depth;
        // do the deadends first, but use floor tiles if we run out
        arrayPushAll(deadends, floorTiles);
        arrayForEach(deadends, function (deadend: Point) {
            let tile = tiles[deadend.x][deadend.y];
            let treasures = min(treasurePileCount, max(rng(sqrt(depth)), 1));
            while (treasures > 0 && tile.tileType == TILE_TYPE_FLOOR && !tile.entity && !tile.featureType) {
                let diceType: DiceType;
                let maxValueCount;
                let maxSideValueCount;
                let scribbles: string[];
                if (depth < 3) {
                    // ensure an even spread early on
                    diceType = DICE_TYPE_NEUTRAL;
                    maxValueCount = 2.4;
                    maxSideValueCount = 1;
                    secretCount = 0;

                    scribbles = NEUTRAL_DICE_HINT_SCRIBBLES[diceHint % NEUTRAL_DICE_HINT_SCRIBBLES.length];
                } else {
                    diceHint = rng(99);
                    diceType = rng(4);
                    let maxLevel = sqrt(rng(depth)) + 1;
                    maxValueCount = 1 + rng(maxLevel * 2);
                    maxSideValueCount = 1 + maxLevel;
                }
                if (secretCount) {
                    secretCount--;
                    tile.tileType = TILE_TYPE_HIDDEN;
                    maxValueCount += 2;
                    maxSideValueCount++;
                }
                if (!tile.scribbles) {
                    tile.scribbles = scribbles;
                }
                let dice = createRandomDice(maxValueCount, maxSideValueCount, diceHint, diceType);
                diceHint++;
                if (dice) {
                    let slot = getBestAvailableTileSlotKey(TILE_SLOTS_ALL, tile, 0, 0);
                    tile.dice[slot] = {
                        dice: dice,
                        upturnedFace: rng(6)
                    }
                }
                treasures--;
            }
            treasurePileCount--;

        });
    }
}
