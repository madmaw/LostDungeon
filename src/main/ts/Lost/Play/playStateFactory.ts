///<reference path="../State.ts"/>
///<reference path="../Util/createElement.ts"/>

function playStateFactory(audioContext: AudioContext, gameService: GameService, levelPopulator: LevelPopulator, homeStateFactory: StateFactory): StateFactory {

    return function(stateTypeId: StateTypeId, data: PlayStateData): State {

        

        function getListenerLocation() {
            return cameraEntityRender.localTransforms;
        }
        let entityRenderSoundEffects: EntityRenderSoundEffects = {
            hurt: webAudioToneSoundEffectFactory(audioContext, getListenerLocation, 'sawtooth', 300, -100, 100, .01, .05, .1, .3),
            diceThrow: webAudioToneSoundEffectFactory(audioContext, getListenerLocation, 'sine', 1000, -400, 100, .04, .1, .2, .5),
            diceLand: webAudioToneSoundEffectFactory(audioContext, getListenerLocation, 'square', 100, 100, 50, .01, .05, .1, .2),
            diceCollect: webAudioToneSoundEffectFactory(audioContext, getListenerLocation, 'sine', 500, 999, 100, .04, .1, .2, .5),
            stepFailed: webAudioToneSoundEffectFactory(audioContext, getListenerLocation, 'square', 200, 100, 10, .05, .01, .04, .1),
            powerup: FEATURE_SOUND_VIBRATO ?
                webAudioVibratoSoundFactory(audioContext, getListenerLocation, 600, 1000, 14, 0.8) :
                webAudioToneSoundEffectFactory(audioContext, getListenerLocation, 'triangle', 100, 800, 100, .4, .1, .1, .6),
            fall: webAudioToneSoundEffectFactory(audioContext, getListenerLocation, 'square', 800, 100, 100, .01, .3, .3, .6),
        }

        let game = data.game;

        let levelId: LevelId;
        if (data.playerTransition) {
            levelId = data.playerTransition.entryLocation.levelId;
            if (data.playerTransition.entryLocation.tileName == 'x') {
                // they just beat the game
                game.gameState = GAME_STATE_WON;
                gameService.saveLevel(game, nil);
                return homeStateFactory(STATE_TYPE_HOME, <HomeStateData>{
                    justExited: <any>1
                });
            }
        } else {
            levelId = game.playerLevelId;

        }
        let level = gameService.getLevel(game, levelId);
        if (!level) {
            // need to create a level
            let rng = mathRandomNumberGenerator;
            let squareSide = 7 + (levelId>>1);
            let area = squareSide * squareSide + levelId;
            let width = squareSide + rng(squareSide/4) - rng(squareSide/4);
            let height = ceil(area / width);
            let tiles = create2DArray(width, height, function (x: number, y: number) {
                let tile: Tile = {
                    tileType: TILE_TYPE_SOLID,
                    dice: {}
                };
                return tile;
            });

            let features: TileDefinition[] = [];

            let numEntrances = max(1, floor(sqrt(levelId/2)));
            let numExits = floor(sqrt(1 + levelId / 2));

            if (levelId == 13) {
                // last level
                numExits = 0;
                arrayPush(
                    features,
                    <TileDefinition>{
                        tileType: TILE_TYPE_PIT,
                        tileName: 'x',
                        boss: <any>1
                    }
                );
            }
            if (levelId < FEATURE_TYPE_COUNT) {
                let featureType = FEATURE_TYPE_ALL[levelId];
                arrayPush(
                    features,
                    {
                        featureType: featureType,
                        tileType: TILE_TYPE_FLOOR,
                        scribbles: FEATURE_TYPE_SCRIBBLES[featureType]
                    }
                );
            } else {
                // ensure there aren't too many health ones
                let featureType: FeatureType;
                if (data.playerTransition.entity.healthSlots < floor(levelId/4 + 1)) {
                    featureType = FEATURE_TYPE_BONUS_HEALTH;
                } else {
                    featureType = FEATURE_TYPE_BONUS_DICE_SLOT;
                }
                arrayPush(
                    features,
                    {
                        featureType: featureType,
                        tileType: TILE_TYPE_FLOOR
                    }
                );
            }

            countForEach(max(numExits, numEntrances), function (count: number) {
                let featureType: FeatureType;
                if (count < numExits) {
                    arrayPush(
                        features,
                        {
                            tileType: TILE_TYPE_PIT,
                            tileName: '' + (levelId + 1) + '' + count,
                            featureType: featureType
                        }
                    );
                }
                if (count < numEntrances) {
                    arrayPush(
                        features,
                        <TileDefinition>{
                            tileType: TILE_TYPE_ROOFLESS,
                            tileName: '' + levelId + '' + count,
                            scribbles: levelId==1?['find', 'a', 'way', 'out']:nil
                        }
                    );
                }
            });

            levelPopulator(game, rng, tiles, width, height, levelId, features);

            // add in a start point and an exit
            /*
            let featureCount = 0;
            let attemptsRemaining = 99;
            o: while (1) {
                let tx = rng(width);
                let ty = rng(height);
                let tile = tiles[tx][ty];
                let justDoIt = attemptsRemaining < 0;
                attemptsRemaining--;
                if (justDoIt) {
                    console.log('gave up searching!');
                }
                if ((tile.type == TILE_TYPE_FLOOR || justDoIt || featureCount) && tile.name != data.playerTransition.location.tileName) {
                    let floors = countSurroundingTiles(tiles, width, height, tx, ty, function (tile: Tile) {
                        return tile.type == TILE_TYPE_FLOOR ? 1 : 0;
                    });

                    if (floors == 1 || featureCount && tile.type == TILE_TYPE_SOLID && floors || justDoIt) {
                        switch (featureCount) {
                            case 0:
                                tile.name = data.playerTransition.location.tileName;
                                tile.type = TILE_TYPE_ROOFLESS;
                                break;
                            case 1:
                                tile.type = TILE_TYPE_PIT;
                                break o;
                        }
                        featureCount++;
                    }
                }
            }
            */


            level = gameService.createLevel(game, width, height, tiles);
        }
        let viewer: Entity;
        let queuedLevelDeltas: LevelDelta[];
        if (data.playerTransition) {
            // need to add the player to the level at the specified spot
            let tileX = 0;
            let tileY = 0;
            let tile = levelFindTile(level, function (tile: Tile, x: number, y: number)  {
                if (tile.tileName == data.playerTransition.entryLocation.tileName) {
                    tileX = x;
                    tileY = y;
                }
            });
            tile = level.tiles[tileX][tileY];
            viewer = data.playerTransition.entity;
            tile.entity = viewer;
            if (FEATURE_AUTO_ORIENT_PLAYER) {
                // orient player to open space
                arrayForEach(ORIENTATION_DIFFS, function (diff: Point, orientation: Orientation) {
                    let tx = tileX + diff.x;
                    let ty = tileY + diff.y;
                    if (tx >= 0 && ty >= 0 && tx < level.levelWidth && ty < level.levelHeight) {
                        let t = level.tiles[tx][ty];
                        if (t.tileType != TILE_TYPE_SOLID) {
                            viewer.entityOrientation = orientation;
                        }
                    }
                });

            }


            queuedLevelDeltas = [{
                deltaType: LEVEL_DELTA_TYPE_DROP_IN,
                deltaData: {
                    entity: viewer
                }
            }];
        } else {
            let tile = levelFindTile(level, function (tile: Tile) {
                return tile.entity && tile.entity.behaviorType == BEHAVIOR_TYPE_PLAYER;
            });
            // always start looking up
            viewer = tile.entity;
            viewer.lookingDown = <any>0;
        }

        if (FEATURE_PRINT_LEVEL) {
            console.log('level ' + levelId);
            for (let y = 0; y < level.levelHeight; y++) {
                let s = '' + y + ':';
                for (let x = 0; x < level.levelWidth; x++) {
                    let tile = level.tiles[x][y];
                    if (tile.tileName) {
                        s += tile.tileName;
                    } else {
                        s += tile.tileType == TILE_TYPE_SOLID ? '#' : (tile.tileType == TILE_TYPE_FLOOR ? '.' : tile.tileType.toString());
                    }

                }
                console.log(s);
            }
        }


        game.playerLevelId = level.levelId;
        gameService.saveLevel(game, level);

        let tileRenders: Render[][];
        let entityRenders: { [_: number]: EntityRender };
        let cameraEntityRender: EntityRender;
        let context: WebGLRenderingContext;

        //private cameraPositionMatrix: Matrix4;
        let cameraProjectionMatrix: Matrix4;

        let updateAnimation: Animation;
        let animationFrameRequest: number;

        let surfaceRenderParams: ShapeRenderParams;
        let diceTextureCoordinates: number[];
        let diceRenderParams: ShapeRenderParams;
        let halfDiceSize = .075;
        let featurePotionBaseHeight = .14;
        let healthRenderParams: ShapeRenderParams;
        let featurePotionRenderParams: ShapeRenderParams;

        let textures: WebGLTexture[] = [];

        let queuedStateChangeData: LevelDeltaDataChangeState;

        let levelUpdater = createLevelUpdater(game, level);
        let canvas: HTMLCanvasElement = <HTMLCanvasElement>getElemById('c');
        let inventory: HTMLDivElement = <HTMLDivElement>getElemById('i');
        let status: HTMLDivElement = <HTMLDivElement>getElemById('s');

        function queueInput(input: Input) {
            // manually force the animation to complete, but don't render as it causes a flicker
            if (updateAnimation) {
                updateAnimation(0, <any>1);
                updateAnimation = nil;
            }
            if (!viewer.dead) {
                levelUpdater.queueInput(input);
            } else {
                playState.stateListener(STATE_TYPE_HOME); 
            }
        }

        function handleSelect(x: number, y: number) {
            let offscreenFramebufferWidth = canvas.clientWidth;
            let offscreenFramebufferHeight = canvas.clientHeight;
            renderOffscreen(offscreenFramebufferWidth, offscreenFramebufferHeight, function () {
                draw(<any>1);
                var pixels = new Uint8Array(4);
                context.readPixels(x, offscreenFramebufferHeight - y, 1, 1, context.RGBA, context.UNSIGNED_BYTE, pixels);
                let id = 0;
                countForEach(3, function (i: number) {
                    id = (id << 8) | pixels[i];
                });
                levelFindTile(level, function (tile: Tile, x: number, y: number) {
                    let result;
                    for (let position in tile.dice) {
                        let diceAndFace = tile.dice[position];
                        if (diceAndFace) {
                            result = diceAndFace.dice.diceId == id;
                            if (result) {
                                queueInput({
                                    inputTypeId: INPUT_TYPE_COLLECT_DICE,
                                    inputData: {
                                        diceId: id,
                                        tileX: x,
                                        tileY: y,
                                        dicePosition: position
                                    }
                                });
                                return result;
                            }
                        }
                    }
                    let entity = tile.entity;
                    let input: Input = {
                        inputTypeId: INPUT_TYPE_NONE
                    };
                    if (entity == viewer) {
                        for (let dice of entity.dice) {
                            let result = dice && dice.diceId == id;
                            if (result) {
                                input = {
                                    inputTypeId: INPUT_TYPE_PLAY_DICE,
                                    inputData: {
                                        diceId: id,
                                        owner: entity
                                    }
                                };
                                return result;
                            }
                        }
                    }
                    queueInput(input);
                });

            });
            // set up the offscreen rendering
            /*
            var pixels = new Uint8Array(4 * offscreenFramebufferWidth * offscreenFramebufferHeight);
            gl.readPixels(0, 0, offscreenFramebufferWidth, offscreenFramebufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            // Create a 2D canvas to store the result
            var canvas = document.createElement('canvas');
            canvas.width = offscreenFramebufferWidth;
            canvas.height = offscreenFramebufferHeight;
            var context = canvas.getContext('2d');

            // Copy the pixels to a 2D canvas
            var imageData = context.createImageData(offscreenFramebufferWidth, offscreenFramebufferHeight);
            imageData.data.set(pixels);
            context.putImageData(imageData, 0, 0);
            console.log(canvas.toDataURL());
            */
        }


        function consume(t: number, levelDeltas: LevelDelta[]): Animation {
            let animation: Animation;
            if (levelDeltas) {
                let animations: Animation[] = [];
                arrayForEach(levelDeltas, function (levelDelta: LevelDelta) {
                    let levelDeltaAnimations: Animation[] = [];
                    mapForEach(entityRenders, function (entityId: string, entityRender: Render) {
                        let animation = entityRender.consume(t, levelDelta);
                        if (animation) {
                            arrayPush(levelDeltaAnimations, animation);
                        } 
                    });
                    switch (levelDelta.deltaType) {
                        case LEVEL_DELTA_TYPE_DIE:
                            let dieData = <LevelDeltaDataDie>levelDelta.deltaData;
                            delete entityRenders[dieData.entity.id];
                            break;
                        case LEVEL_DELTA_TYPE_CHANGE_STATE:
                            queuedStateChangeData = <LevelDeltaDataChangeState>levelDelta.deltaData;
                            break;
                    }
                    let levelDeltaAnimation = animationCompositeFactory(levelDeltaAnimations);
                    if (levelDelta.deltaChildren) {
                        levelDeltaAnimation = animationChainedProxyFactory(
                            levelDeltaAnimation,
                            function (t: number) {
                                return consume(t, levelDelta.deltaChildren);
                            }
                        );
                    }
                    arrayPush(animations, levelDeltaAnimation);
                });
                animation = animationCompositeFactory(animations);
            }
            return animation;
        }

        function animate(t: number) {
            if (updateAnimation) {
                let done = updateAnimation(t);
                if (done) {
                    updateAnimation = null;
                }
            } else {
                update(t);
            }
            mapForEach(entityRenders, function (key: string, entityRender: Render) {
                entityRender.update(t);
            });
            draw();
            if (queuedStateChangeData) {
                playState.stateListener(queuedStateChangeData.stateTypeId, queuedStateChangeData.stateData);
            }
        }

        function update(t: number) {
            var levelUpdate = levelUpdater.updateLevel();
            // are they dead?
            if (viewer.dead) {
                game.gameState = GAME_STATE_DEAD;
            }
            // save the changes
            if (levelUpdate.deltas) {
                gameService.saveLevel(game, level);
            }

            // animate the update
            updateAnimation = consume(t, levelUpdate.deltas);

            if (!updateAnimation && !levelUpdate.awaitingInput && !viewer.dead) {
                update(t);
            }
        }

        function resize() {
            let width = canvas.clientWidth;
            let height = canvas.clientHeight;

            canvas.width = width;
            canvas.height = height;

            context.viewport(0, 0, width, height);
            cameraProjectionMatrix = matrixPerspective4(pi / 3, width / height, .1, 100);
        }

        function redraw() {
            let gl = context;
            let rng = mathRandomNumberGenerator;

            let groutWidth = rng(3) + 1;
            let textureDimension = 256;
            let brickRounding = rng(6);
            let colors = createRandomWallColors(rng);
            let bricksAcross = (rng(2) + 2) * 2;
            let bricksDown = (rng(3) + 2) * 2;
            let roofTilesAcross = (rng(4) + 1);
            let roofTilesDown = (rng(4) + 1);
            if (bricksAcross >= bricksDown) {
                bricksAcross = bricksDown - 1;
            }

            let blankTexture = webglCanvasToTexture(gl, createPickTexture(0));
            arrayPush(textures, blankTexture);

            updateAnimation = null;
            entityRenders = {};
            create2DArray(level.levelWidth, level.levelHeight, function (x: number, y: number, tileRenders2: Render[][]) {
                tileRenders = tileRenders2;
                let tile = level.tiles[x][y];
                let childRenders: { [_: string]: Render } = {};

                if (tile.tileType != TILE_TYPE_SOLID) {
                    let hole = tile.tileType == TILE_TYPE_ROOFLESS || tile.tileType == TILE_TYPE_PIT;
                    let text1: string[];
                    let text2: string[];
                    let yRotation = 0;
                    let upperColor = colors.wallUpper;
                    switch (tile.tileType) {
                        case TILE_TYPE_PIT:
                            text1 = ['▲'];
                            text2 = ['▼'];
                            break;
                        case TILE_TYPE_HIDDEN:
                            let character = DICE_SYMBOL_CHARACTERS[rng(DICE_SYMBOL_CHARACTERS.length)];
                            let text: string[] = [character];
                            countForEach(bricksAcross * bricksDown / 2, function () {
                                arrayPush(text, ' ');
                            });
                            randomizeArray(rng, text);
                            text1 = text;
                            text2 = text;
                            yRotation = pi;
                            upperColor = colors.wallLower;
                            break;
                        default:
                            if (tile.scribbles && FEATURE_TUTORIAL) {
                                text1 = [];
                                let spaces = [];
                                countForEach(((bricksAcross-.5) * bricksDown - tile.scribbles.length)/2, function () {
                                    spaces.push('');
                                });
                                arrayPushAll(text1, spaces);
                                arrayPushAll(text1, tile.scribbles);
                                arrayPushAll(text1, spaces);
                                text2 = text1;
                            }
                    }
                    let wallTexture1 = webglCanvasToTexture(gl, createRepeatingBrickPattern(rng, textureDimension, textureDimension, bricksAcross, bricksDown, .5, 0, upperColor, colors.wallLower, brickRounding, groutWidth, colors.grout, text1));
                    let wallTexture2 = webglCanvasToTexture(gl, createRepeatingBrickPattern(rng, textureDimension, textureDimension, bricksAcross, bricksDown, .5, .5, upperColor, colors.wallLower, brickRounding, groutWidth, colors.grout, text2));
                    let westSolid = x == 0 || isTileTypeSolid(level.tiles[x - 1][y].tileType);
                    if (westSolid || yRotation) {
                        // add a wall to the west
                        childRenders['w'] = shapeRenderFactory([matrixTranslate4(-.5, .5, 0), matrixRotateZ4(piOn2 + (westSolid?0:yRotation)), matrixRotateY4(piOn2)], surfaceRenderParams, wallTexture1, blankTexture);
                    }
                    let eastSolid = x == level.levelWidth - 1 || isTileTypeSolid(level.tiles[x + 1][y].tileType);
                    if (eastSolid || yRotation) {
                        // add a wall to the west
                        childRenders['e'] = shapeRenderFactory([matrixTranslate4(.5, .5, 0), matrixRotateZ4(-piOn2 + (eastSolid ? 0 : yRotation)), matrixRotateY4(-piOn2)], surfaceRenderParams, wallTexture1, blankTexture);
                    }
                    let northSolid = y == 0 || isTileTypeSolid(level.tiles[x][y - 1].tileType);
                    if (northSolid || yRotation) {
                        // add a wall to the west
                        childRenders['n'] = shapeRenderFactory([matrixTranslate4(0, .5, -.5), matrixRotateX4(-piOn2 + (northSolid ? 0 : yRotation))], surfaceRenderParams, wallTexture2, blankTexture);
                    }
                    let southSolid = y == level.levelHeight - 1 || isTileTypeSolid(level.tiles[x][y + 1].tileType)
                    if (southSolid || yRotation) {
                        // add a wall to the west
                        childRenders['s'] = shapeRenderFactory([matrixTranslate4(0, .5, .5), matrixRotateX4(piOn2 + (southSolid ? 0 : yRotation)), matrixRotateY4(pi)], surfaceRenderParams, wallTexture2, blankTexture);
                    }
                    // add a floor
                    let floorTexture = webglCanvasToTexture(gl, createRepeatingBrickPattern(rng, textureDimension, textureDimension, 1, 1, 0, 0, colors.floor, colors.floor, brickRounding * 4, groutWidth * 3, colors.grout, tile.tileType == TILE_TYPE_ROOFLESS ? [<any>level.levelId] : nil));
                    if (tile.tileType == TILE_TYPE_PIT) {
                        childRenders['W'] = shapeRenderFactory([matrixTranslate4(.5, -.5, 0), matrixRotateZ4(-piOn2), matrixRotateY4(piOn2)], surfaceRenderParams, wallTexture2);
                        childRenders['E'] = shapeRenderFactory([matrixTranslate4(-.5, -.5, 0), matrixRotateZ4(piOn2), matrixRotateY4(-piOn2)], surfaceRenderParams, wallTexture2);
                        childRenders['N'] = shapeRenderFactory([matrixTranslate4(0, -.5, .5), matrixRotateX4(piOn2)], surfaceRenderParams, wallTexture1);
                        childRenders['S'] = shapeRenderFactory([matrixTranslate4(0, -.5, -.5), matrixRotateX4(-piOn2), matrixRotateY4(pi)], surfaceRenderParams, wallTexture1);
                    } else {
                        childRenders['f'] = shapeRenderFactory([matrixRotateY4(pi / 2 * rng(4))], surfaceRenderParams, floorTexture);
                    }
                    let ceilingTexture = webglCanvasToTexture(gl, createRepeatingBrickPattern(rng, textureDimension, textureDimension, roofTilesAcross, roofTilesDown, 1 / (rng(roofTilesAcross) + 1), 0, colors.wallUpper, colors.wallUpper, brickRounding, groutWidth, colors.grout));
                    if (tile.tileType == TILE_TYPE_ROOFLESS) {
                        childRenders['W'] = shapeRenderFactory([matrixTranslate4(.5, 1.5, 0), matrixRotateZ4(-piOn2), matrixRotateY4(piOn2)], surfaceRenderParams, wallTexture2);
                        childRenders['E'] = shapeRenderFactory([matrixTranslate4(-.5, 1.5, 0), matrixRotateZ4(piOn2), matrixRotateY4(-piOn2)], surfaceRenderParams, wallTexture2);
                        childRenders['N'] = shapeRenderFactory([matrixTranslate4(0, 1.5, .5), matrixRotateX4(piOn2)], surfaceRenderParams, wallTexture1);
                        childRenders['S'] = shapeRenderFactory([matrixTranslate4(0, 1.5, -.5), matrixRotateX4(-piOn2), matrixRotateY4(pi)], surfaceRenderParams, wallTexture1);
                    } else {
                        childRenders['c'] = shapeRenderFactory([matrixTranslate4(0, 1, 0), matrixRotateX4(pi)], surfaceRenderParams, ceilingTexture);
                    }
                    let featureTexture: WebGLTexture;
                    if (tile.featureType) {
                        let colors = FEATURE_TYPE_COLORS[tile.featureType];

                        let canvas = createRepeatingBrickPattern(rng, 64, 256, 1, 2, 0, 0, colors.upper, colors.lower, 4, 10, '#fff', [FEATURE_TYPE_NAMES[tile.featureType], ' ']);
                        featureTexture = webglCanvasToTexture(gl, canvas);
                        let yoffset = featurePotionBaseHeight;
                        if (tile.tileType == TILE_TYPE_PIT) {
                            yoffset += .3;
                        }
                        let render = shapeRenderFactory([matrixTranslate4(0, yoffset, 0)], featurePotionRenderParams, featureTexture);
                        childRenders['b'] = render;
                    }
                    arrayPushAll(textures, [wallTexture1, wallTexture2, ceilingTexture, floorTexture, featureTexture]);
                }
                if (tile.entity) {
                    // add the entity render
                    let render = createEntityRender(tile.entity, x, y);
                    entityRenders[tile.entity.id] = render;
                    if (tile.entity.behaviorType == BEHAVIOR_TYPE_PLAYER) {
                        cameraEntityRender = render;
                    }
                }

                mapForEach(tile.dice, function (key: string, diceAndFace: DiceAndFace) {
                    if (diceAndFace) {
                        let slot: TileSlot = TILE_SLOTS_ALL[key];
                        let render = createRestingTileDiceRender(diceAndFace.dice, slot.dx, slot.dy, diceAndFace.upturnedFace, slot.slotRotation);
                        childRenders[key] = render;
                    }
                });


                let transform = matrixTranslate4(x, 0, y);
                let tileRender = compositeRenderFactory([transform], childRenders);
                return tileRender;
            });
            draw();
        }

        function draw(usePickTextures?: boolean) {

            let gl = context;
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

            if (cameraEntityRender) {
                let cameraPosition = matrixInvert4(cameraEntityRender.bodyPosition);
                let cameraRotation = matrixInvert4(cameraEntityRender.bodyRotation);
                let transformStack: Matrix4[] = [
                    cameraEntityRender.headRotation,
                    cameraRotation,
                    cameraPosition
                ];
                let lightLocations: number[] = [];
                let lightCount = 0;
                for (let entityId in entityRenders) {
                    let entityRender = entityRenders[entityId];
                    arrayPushAll(lightLocations, vectorTransform3Matrix4(0, 0, 0, entityRender.bodyPosition));
                    lightCount++;
                }
                lightLocations = vectorTransform3Matrix4(0, 0, 0, cameraEntityRender.bodyPosition);
                let renderScope: RenderScope = {
                    projection: cameraProjectionMatrix,
                    lightLocations: lightLocations,
                    lightCount: lightCount,
                    ambientLight: usePickTextures ? 1 : .6,
                    maxDistanceSquared: 27,
                    minDistanceMult: usePickTextures ? 1 : 0,
                    usePickTextures: usePickTextures
                };

                levelFindTile(level, function (tile: Tile, x: number, y: number) {
                    let tileRender = tileRenders[x][y];
                    tileRender.draw(gl, transformStack, renderScope);
                });

                mapForEach(entityRenders, function (key: string, entityRender: Render) {
                    entityRender.draw(gl, transformStack, renderScope);
                });

            }
        }

        function createEntityRender(entity: Entity, x: number, y: number): EntityRender {
            let rotation = matrixRotateY4(ORIENTATION_ANGLES[entity.entityOrientation]);
            let position = matrixTranslate4(x, .5, y);

            let diceRenders: { [_: string]: RenderAndIndex } = {};
            arrayForEach(entity.dice, function (dice: Dice, index: number) {
                if (dice) {
                    let diceRender = createEntityDiceRender(dice, index, entity.dice.length);
                    diceRenders[dice.diceId] = {
                        render: diceRender,
                        index: index
                    }
                }
            });
            let healthCount = entity.healthSlots;
            let healthRenders: Render[] = [];
            while (healthCount) {
                healthCount--;
                let healthRender = createHealthRender(entity.entityType);
                arrayPush(healthRenders, healthRender);
            }

            return entityRenderFactory(
                entity,
                position,
                rotation,
                healthRenders,
                diceRenders,
                tileRenders,
                redrawInventory,
                halfDiceSize,
                levelUpdater.getEffectiveResourceCounts(entity),
                levelUpdater.getEffectiveHealth(entity),
                entityRenderSoundEffects
            );
        }

        function createHealthRender(entityType: EntityType): Render {
            let rng = function() {
                return 0;
            };

            
            let color: string = ENTITY_TYPE_COLORS[entityType];
            let canvas = createRepeatingBrickPattern(rng, 32, 64, 1, 1, 0, 0, '#aaa', color, 0, 0, '#fff');

            let texture = webglCanvasToTexture(context, canvas);
            arrayPush(textures, texture);
            let transforms: Matrix4[] = [];

            return shapeRenderFactory(transforms, healthRenderParams, texture);
        }

        function createDiceRender(dice: Dice, transformations: Matrix4[]): Render {
            let canvas = createDiceTexture(512, 256, diceTextureCoordinates, dice);
            let texture = webglCanvasToTexture(context, canvas);
            arrayPush(textures, texture);

            let pickTexture = webglCanvasToTexture(context, createPickTexture(dice.diceId));

            return shapeRenderFactory(transformations, diceRenderParams, texture, pickTexture);

        }

        function createEntityDiceRender(dice: Dice, index: number, count: number) {

            let transformations = [];
            return createDiceRender(dice, transformations);
        }

        function createRestingTileDiceRender(dice: Dice, x: number, y: number, face: DiceFace, yAngle: number): Render {

            //let rotation = matrixMultiply4(matrixRotateY4(pi * random()), DICE_FACE_ROTATIONS[face].matrix);
            let yRotation = matrixRotateY4(yAngle);
            let rotation = matrixCopy4(DICE_FACE_ROTATIONS[face].matrix);
            let position = matrixTranslate4(x, halfDiceSize, y);
            return createDiceRender(dice, [position, yRotation, rotation]);
        }

        function redrawInventory() {
            let render = cameraEntityRender;
            let entity = render.entity;
            inventory.innerHTML = '';
            status.innerHTML = '';

            // add the status area back in
            inventory.appendChild(status);


            // draw in the health
            let healthCount = render.effectiveHealth;
            while (healthCount > 0) {
                healthCount--;

                let dimension = min(inventory.clientWidth, inventory.clientHeight) >> 2;

                let healthRender = render.healthRenders[healthCount];
                if (!healthRender) {
                    healthRender = createHealthRender(entity.entityType);
                    render.healthRenders[healthCount] = healthRender;
                }
                let canvas = renderToCanvas(healthRender, dimension, dimension, halfDiceSize, 0, 0);
                status.appendChild(canvas);
            }

            arrayForEach(RESOURCE_TYPE_ALL, function (resourceType: ResourceType) {
                let value = render.effectiveResourceCounts[resourceType];
                if (!value) {
                    value = 0;
                }
                let div = createElement('h2', { 'class': 'r' + resourceType });
                let t = '► ';
                while (value) {
                    if (value > 0) {
                        t += '●';
                        value--;
                    } else {
                        t += '○';
                        value++;
                    }
                }
                div.innerText = t;
                status.appendChild(div);
            });


            countForEach(entity.diceSlots, function (i: number) {
                let dice = entity.dice[i];
                let slotRender = createElement('div', { 'class': 't' });
                inventory.appendChild(slotRender);
                let canvasWidth = slotRender.clientWidth;
                let canvasHeight = slotRender.clientHeight;

                if (dice) {
                    let diceRender = render.diceRenders[dice.diceId].render;
                    /*
                    if (!diceRender) {
                        diceRender = createEntityDiceRender(dice, i, entity.dice.length);
                        render.diceRenders[dice.diceId] = diceRender;
                    }
                    */
                    //diceRender.localTransforms = [];
                    // render the dice to an offscreen buffer

                    let canvas = renderToCanvas(diceRender, canvasWidth, canvasHeight, halfDiceSize, pi / 5, pi / 4);

                    canvas.onclick = function() {
                        
                        let data: InputDataPlayDice = {
                            diceId: dice.diceId,
                            owner: entity
                        };
                        queueInput({
                            inputTypeId: INPUT_TYPE_PLAY_DICE,
                            inputData: data
                        });
                    };

                    slotRender.appendChild(canvas);
                }
            });
        }

        function renderOffscreen(offscreenFramebufferWidth: number, offscreenFramebufferHeight: number, renderOffscreenAndConsume: () => void) {
            let gl = context;
            let offscreenFramebuffer = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, offscreenFramebuffer);
            //offscreenFramebuffer['width'] = offscreenFramebufferWidth;
            //offscreenFramebuffer['height'] = offscreenFramebufferHeight;

            let offscreenTexture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, offscreenTexture);
            //gl.generateMipmap(gl.TEXTURE_2D);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, offscreenFramebufferWidth, offscreenFramebufferHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

            let offscreenRenderbuffer = gl.createRenderbuffer();
            gl.bindRenderbuffer(gl.RENDERBUFFER, offscreenRenderbuffer);
            gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, offscreenFramebufferWidth, offscreenFramebufferHeight);

            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, offscreenTexture, 0);
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, offscreenRenderbuffer);
            gl.viewport(0, 0, offscreenFramebufferWidth, offscreenFramebufferHeight);

            renderOffscreenAndConsume();

            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.deleteFramebuffer(offscreenFramebuffer);
            gl.deleteTexture(offscreenTexture);
            gl.deleteRenderbuffer(offscreenRenderbuffer);
            // reset the viewport (shorter than calling viewport method directly!)
            resize();

        }

        function renderToCanvas(render: Render, canvasWidth: number, canvasHeight: number, halfObjectSize: number, rotateX: number, rotateY: number): HTMLCanvasElement {

            let canvas = createCanvas(canvasWidth, canvasHeight);

            renderOffscreen(canvasWidth, canvasHeight, function () {
                let depth = 400;
                // really want to use an orthographic projection
                let projection: Matrix4 = [
                    2 / canvasWidth, 0, 0, 0,
                    0, -2 / canvasHeight, 0, 0,
                    0, 0, 2 / depth, 0,
                    -1, 1, 0, 1,
                ];
                let scale = canvasWidth / (halfObjectSize * 3);
                //scale = 3;
                let scaleMatrix: Matrix4 = [
                    scale, 0, 0, 0,
                    0, scale, 0, 0,
                    0, 0, scale, 0,
                    0, 0, 0, 1
                ];
                //matrixPerspective4(pi / 3, canvasWidth / canvasHeight, .1, 1000000)

                let transformStack: Matrix4[] = [
                    matrixTranslate4(canvasWidth / 2, canvasHeight / 2, -50),
                    scaleMatrix,
                    matrixRotateX4(rotateX),
                    matrixRotateY4(rotateY),
                ];
                let oldTransforms = render.localTransforms;
                render.localTransforms = [];
                render.draw(context, transformStack, {
                    lightLocations: [0, 0, 0],
                    lightCount: 0,
                    projection: projection,
                    ambientLight: 1,
                    maxDistanceSquared: 1,
                    minDistanceMult: 1
                });
                render.localTransforms = oldTransforms;

                var pixels = new Uint8Array(4 * canvasWidth * canvasHeight);
                context.readPixels(0, 0, canvasWidth, canvasHeight, context.RGBA, context.UNSIGNED_BYTE, pixels);
                var context2d = canvas.getContext('2d');

                // Copy the pixels to a 2D canvas
                var imageData = context2d.createImageData(canvasWidth, canvasHeight);
                imageData.data.set(pixels);
                context2d.putImageData(imageData, 0, 0);
            });

            return canvas;
        }

        var playState: State = {
            stateElementId: 'p',
            initState: function(stateListener: StateListener) {

                let xDown;
                let yDown;
                let timeDown;
                let xDiff;
                let yDiff;

                let eventListeners = {
                    'resize': function() {
                        resize();
                        redrawInventory();
                    },
                    'keydown': function(e: KeyboardEvent) {
                        let type: InputType;
                        let data: InputData;
                        switch (e.keyCode) {
                            // left
                            case 37:
                            // a
                            case 65:
                                type = INPUT_TYPE_TURN;
                                data = <InputDataTurn>{
                                    fromOrientationHint: viewer.entityOrientation,
                                    orientationDelta: -1
                                }
                                break;
                            // up
                            case 38:
                            // w
                            case 87:
                                type = INPUT_TYPE_MOVE_FORWARD;
                                break;
                            // right
                            case 39:
                            // d
                            case 68:
                                type = INPUT_TYPE_TURN;
                                data = <InputDataTurn>{
                                    fromOrientationHint: viewer.entityOrientation,
                                    orientationDelta: 1
                                }
                                break;
                            // down
                            case 40:
                            // s
                            case 83:
                                type = INPUT_TYPE_LOOK_DOWN;
                                break;
                        }
                        queueInput({
                            inputTypeId: type,
                            inputData: data
                        });
                    },
                    'click': function (e: MouseEvent) {
                        handleSelect(e.clientX, e.clientY);
                    },
                    'touchstart': function (e: TouchEvent) {
                        let touch = e.touches[0];
                        xDown = touch.clientX;
                        yDown = touch.clientY;
                        if (xDown < canvas.width && yDown < canvas.height) {
                            xDiff = 0;
                            yDiff = 0;
                            timeDown = e.timeStamp;
                            e.preventDefault();
                        } else {
                            timeDown = 0;
                        }
                    },
                    'touchmove': function (e: TouchEvent) {
                        let touch = e.touches[0];
                        xDiff = touch.clientX - xDown;
                        yDiff = touch.clientY - yDown;
                    },
                    'touchend': function (e: TouchEvent) {
                        if (timeDown) {
                            let timeDiff = e.timeStamp - timeDown;

                            if (timeDiff < 400) {
                                if (abs(xDiff) + abs(yDiff) < 50) {
                                    // click
                                    handleSelect(xDown, yDown);
                                } else {
                                    let type: InputType;
                                    let data: InputData;
                                    if (abs(xDiff) < abs(yDiff)) {
                                        // swipe vertically
                                        if (yDiff > 0) {
                                            type = INPUT_TYPE_MOVE_FORWARD;
                                        } else {
                                            type = INPUT_TYPE_LOOK_DOWN;
                                        }
                                    } else {
                                        // swipe horizontally
                                        type = INPUT_TYPE_TURN;
                                        let orientationDelta;
                                        if (xDiff > 0) {
                                            orientationDelta = -1;
                                        } else {
                                            orientationDelta = 1;
                                        }
                                        data = <InputDataTurn>{
                                            fromOrientationHint: viewer.entityOrientation,
                                            orientationDelta: orientationDelta
                                        }
                                    }
                                    queueInput({
                                        inputTypeId: type,
                                        inputData: data
                                    });
                                }
                            }

                        }
                    }
                };
                stateDefaultInit(playState, stateListener, eventListeners);

                context = canvas.getContext('webgl');

                let gl = context;

                gl.clearColor(0, 0, 0, 1);
                gl.enable(gl.DEPTH_TEST);
                gl.depthFunc(gl.LEQUAL);
                gl.enable(gl.CULL_FACE);

                // set up the shaders
                var fragmentShader = webglGetShader(gl, shapeRenderFragmentShaderScript, gl.FRAGMENT_SHADER);
                var vertexShader = webglGetShader(gl, shapeRenderVertexShaderScript, gl.VERTEX_SHADER);

                // Create the shader program

                let shaderProgram = gl.createProgram();
                gl.attachShader(shaderProgram, vertexShader);
                gl.attachShader(shaderProgram, fragmentShader);
                gl.linkProgram(shaderProgram);

                // If creating the shader program failed, alert

                if (FEATURE_CHECK_SHADER_ERRORS) {
                    let ok = gl.getProgramParameter(shaderProgram, gl.LINK_STATUS);
                    if (!ok) {
                        throw gl.getProgramInfoLog(shaderProgram);
                    }
                }

                gl.useProgram(shaderProgram);

                let surfaceVertices = [
                    .5, 0, .5,
                    -.5, 0, .5,
                    .5, 0, -.5,
                    -.5, 0, -.5
                ];
                let surfaceNormals = [
                    0, 1, 0,
                    0, 1, 0,
                    0, 1, 0,
                    0, 1, 0
                ];
                let surfaceIndices = [
                    0, 2, 1,
                    2, 3, 1
                ];
                let surfaceTextureCoordinates = [
                    1, 1,
                    0, 1,
                    1, 0,
                    0, 0
                ];
                surfaceRenderParams = shapeRenderInit(
                    gl,
                    shaderProgram,
                    surfaceVertices,
                    surfaceNormals,
                    surfaceIndices,
                    surfaceTextureCoordinates
                );

                //let halfDiceSize = 5;
                halfDiceSize = halfDiceSize;
                let diceVertices = [
                    // Front face
                    -halfDiceSize, -halfDiceSize, halfDiceSize,
                    halfDiceSize, -halfDiceSize, halfDiceSize,
                    halfDiceSize, halfDiceSize, halfDiceSize,
                    -halfDiceSize, halfDiceSize, halfDiceSize,

                    // Back face
                    -halfDiceSize, -halfDiceSize, -halfDiceSize,
                    -halfDiceSize, halfDiceSize, -halfDiceSize,
                    halfDiceSize, halfDiceSize, -halfDiceSize,
                    halfDiceSize, -halfDiceSize, -halfDiceSize,

                    // Top face
                    -halfDiceSize, halfDiceSize, -halfDiceSize,
                    -halfDiceSize, halfDiceSize, halfDiceSize,
                    halfDiceSize, halfDiceSize, halfDiceSize,
                    halfDiceSize, halfDiceSize, -halfDiceSize,

                    // Bottom face
                    -halfDiceSize, -halfDiceSize, -halfDiceSize,
                    halfDiceSize, -halfDiceSize, -halfDiceSize,
                    halfDiceSize, -halfDiceSize, halfDiceSize,
                    -halfDiceSize, -halfDiceSize, halfDiceSize,

                    // Right face
                    halfDiceSize, -halfDiceSize, -halfDiceSize,
                    halfDiceSize, halfDiceSize, -halfDiceSize,
                    halfDiceSize, halfDiceSize, halfDiceSize,
                    halfDiceSize, -halfDiceSize, halfDiceSize,

                    // Left face
                    -halfDiceSize, -halfDiceSize, -halfDiceSize,
                    -halfDiceSize, -halfDiceSize, halfDiceSize,
                    -halfDiceSize, halfDiceSize, halfDiceSize,
                    -halfDiceSize, halfDiceSize, -halfDiceSize
                ];
                let diceNormals = [
                    // front face
                    0, 0, 1,
                    0, 0, 1,
                    0, 0, 1,
                    0, 0, 1,

                    // back face
                    0, 0, -1,
                    0, 0, -1,
                    0, 0, -1,
                    0, 0, -1,

                    // top face
                    0, 1, 0,
                    0, 1, 0,
                    0, 1, 0,
                    0, 1, 0,

                    // bottom face
                    0, -1, 0,
                    0, -1, 0,
                    0, -1, 0,
                    0, -1, 0,

                    // right face
                    1, 0, 0,
                    1, 0, 0,
                    1, 0, 0,
                    1, 0, 0,

                    // left face
                    -1, 0, 0,
                    -1, 0, 0,
                    -1, 0, 0,
                    -1, 0, 0
                ];
                let diceIndices = [
                    // front
                    0, 1, 2,
                    0, 2, 3,
                    // back
                    4, 5, 6,
                    4, 6, 7,
                    // top
                    8, 9, 10,
                    8, 10, 11,
                     // bottom
                    12, 13, 14,
                    12, 14, 15,
                    // right
                    16, 17, 18,
                    16, 18, 19,
                    // left
                    20, 21, 22,
                    20, 22, 23,  
                ];
                diceTextureCoordinates = [
                    // Front
                    0, 0,
                    .25, 0,
                    .25, .5,
                    0, .5,
                    // Back
                    .25, .5,
                    .25, 0,
                    .5, 0,
                    .5, .5,
                    // Top
                    .5, 0,
                    .75, 0,
                    .75, .5,
                    .5, .5,
                    // Bottom
                    0, .5,
                    .25, .5,
                    .25, 1,
                    0, 1,
                    // Right
                    .25, 1,
                    .25, .5,
                    .5, .5,
                    .5, 1,
                    // Left
                    .5, .5,
                    .75, .5,
                    .75, 1,
                    .5, 1
                ];
                diceRenderParams = shapeRenderInit(
                    gl,
                    shaderProgram,
                    diceVertices,
                    diceNormals,
                    diceIndices,
                    diceTextureCoordinates
                );
                let healthRadius = .1;
                let healthInnerRadius = healthRadius * .6;
                let healthDepth = .02;
                let healthVertices = [

                    // outside

                    // 0. top divet              
                    0, healthRadius * .8, 0, 
                    // 1. right top ridge start
                    healthRadius * .2, healthRadius, 0, 
                    // 2. right top ridge end
                    healthRadius * .6, healthRadius, 0, 
                    // 3. right top edge
                    healthRadius, healthRadius * .6, 0, 
                    // 4. right bottom edge
                    healthRadius * .9, 0, 0,
                    // 5. bottom point
                    0, -healthRadius, 0,
                    // 6. left bottom edge
                    -healthRadius * .9, 0, 0,
                    // 7. left top edge
                    -healthRadius, healthRadius * .6, 0,
                    // 8. left top ridge start
                    -healthRadius * .6, healthRadius, 0,
                    // 9. left top ridge end
                    -healthRadius * .2, healthRadius, 0,

                    // inside front

                    // 10. top divet
                    0, healthInnerRadius * .6, healthDepth,
                    // 11. right top ridge start
                    healthInnerRadius * .2, healthInnerRadius, healthDepth,
                    // right top ridge end
                    healthInnerRadius * .6, healthInnerRadius, healthDepth,
                    // right top edge
                    healthInnerRadius, healthInnerRadius * .6, healthDepth,
                    // right bottom edge
                    healthInnerRadius * .9, 0, healthDepth,
                    // bottom point
                    0, -healthInnerRadius, healthDepth,
                    // left bottom edge
                    -healthInnerRadius * .9, 0, healthDepth,
                    // left top edge
                    -healthInnerRadius, healthInnerRadius * .6, healthDepth,
                    // left top ridge start
                    -healthInnerRadius * .6, healthInnerRadius, healthDepth,
                    // left top ridge end
                    -healthInnerRadius * .2, healthInnerRadius, healthDepth,

                    // inside back

                    // top divet
                    0, healthInnerRadius * .6, -healthDepth,
                    // right top ridge start
                    healthInnerRadius * .2, healthInnerRadius, -healthDepth,
                    // right top ridge end
                    healthInnerRadius * .6, healthInnerRadius, -healthDepth,
                    // right top edge
                    healthInnerRadius, healthInnerRadius * .6, -healthDepth,
                    // right bottom edge
                    healthInnerRadius * .9, 0, -healthDepth,
                    // bottom point
                    0, -healthInnerRadius, -healthDepth,
                    // left bottom edge
                    -healthInnerRadius * .9, 0, -healthDepth,
                    // left top edge
                    -healthInnerRadius, healthInnerRadius * .6, -healthDepth,
                    // left top ridge start
                    -healthInnerRadius * .6, healthInnerRadius, -healthDepth,
                    // left top ridge end
                    -healthInnerRadius * .2, healthInnerRadius, -healthDepth,

                    // front center
                    0, 0, healthDepth,

                    // back center
                    0, 0, -healthDepth
                ];
                let healthNormals = [
                    // 0. top divet              
                    0, 1, 0,
                    // 1. right top ridge start
                    0, 1, 0,
                    // 2. right top ridge end
                    0, 1, 0,
                    // 3. right top edge
                    1, 0, 0,
                    // 4. right bottom edge
                    1, 0, 0,
                    // 5. bottom point
                    0, -1, 0,
                    // 6. left bottom edge
                    -1, 0, 0,
                    // 7. left top edge
                    -1, 0, 0,
                    // 8. left top ridge start
                    0, 1, 0,
                    // 9. left top ridge end
                    0, 1, 0,

                    // inside front

                    // 10. top divet
                    0, 0, 1,
                    // 11. right top ridge start
                    0, 0, 1,
                    // right top ridge end
                    0, 0, 1,
                    // right top edge
                    0, 0, 1,
                    // right bottom edge
                    0, 0, 1,
                    // bottom point
                    0, 0, 1,
                    // left bottom edge
                    0, 0, 1,
                    // left top edge
                    0, 0, 1,
                    // left top ridge start
                    0, 0, 1,
                    // left top ridge end
                    0, 0, 1,

                    // inside back

                    // top divet
                    0, 0, -1,
                    // right top ridge start
                    0, 0, -1,
                    // right top ridge end
                    0, 0, -1,
                    // right top edge
                    0, 0, -1,
                    // right bottom edge
                    0, 0, -1,
                    // bottom point
                    0, 0, -1,
                    // left bottom edge
                    0, 0, -1,
                    // left top edge
                    0, 0, -1,
                    // left top ridge start
                    0, 0, -1,
                    // left top ridge end
                    0, 0, -1,

                    // front center
                    0, 0, 1,

                    // back center
                    0, 0, -1,

                ];

                let healthIndices = [
                    // front edges
                    0, 10, 11,
                    1, 0, 11,
                    1, 11, 12,
                    2, 1, 12,
                    2, 12, 13,
                    3, 2, 13,
                    3, 13, 14,
                    4, 3, 14,
                    4, 14, 15,
                    5, 4, 15,
                    5, 15, 16,
                    6, 5, 16,
                    6, 16, 17,
                    7, 6, 17,
                    7, 17, 18,
                    8, 7, 18,
                    8, 18, 19,
                    9, 8, 19,
                    9, 19, 10,
                    0, 9, 10,

                    // back edges edges
                    20, 0, 21,
                    0, 1, 21,
                    21, 1, 22,
                    1, 2, 22,
                    22, 2, 23,
                    2, 3, 23,
                    23, 3, 24,
                    3, 4, 24,
                    24, 4, 25,
                    4, 5, 25,
                    25, 5, 26,
                    5, 6, 26,
                    26, 6, 27,
                    6, 7, 27,
                    27, 7, 28,
                    7, 8, 28,
                    28, 8, 29,
                    8, 9, 29,
                    29, 9, 20,
                    9, 0, 20,

                    // front
                    11, 10, 30,
                    12, 11, 30,
                    13, 12, 30,
                    14, 13, 30,
                    15, 14, 30,
                    16, 15, 30,
                    17, 16, 30,
                    18, 17, 30,
                    19, 18, 30,
                    10, 19, 30,

                    // back
                    20, 21, 31,
                    21, 22, 31,
                    22, 23, 31,
                    23, 24, 31,
                    24, 25, 31,
                    25, 26, 31,
                    26, 27, 31,
                    27, 28, 31,
                    28, 29, 31,
                    29, 20, 31

                ];

                let healthTextureCoordinates = [];
                let i = 0;
                while (i < healthVertices.length) {
                    let x = (healthVertices[i] + healthRadius)/(healthRadius * 2);
                    let y = (healthVertices[i + 1] + healthRadius)/(healthRadius * 2);
                    healthTextureCoordinates.push(x, y);
                    i += 3;
                }


                healthRenderParams = shapeRenderInit(
                    gl,
                    shaderProgram,
                    healthVertices,
                    healthNormals,
                    healthIndices,
                    healthTextureCoordinates
                )

                let featurePotionNeckWidth = .02;
                let featurePotionNeckHeight = .1;
                let featurePotionBaseWidth = .08;
                

                let featurePotionVertices = [
                    // front

                    // top left
                    -featurePotionNeckWidth, featurePotionNeckHeight, featurePotionNeckWidth,
                    // top right
                    featurePotionNeckWidth, featurePotionNeckHeight, featurePotionNeckWidth,
                    // middle right
                    featurePotionNeckWidth, 0, featurePotionNeckWidth,
                    // bottom right
                    featurePotionBaseWidth, -featurePotionBaseHeight,  featurePotionBaseWidth,
                    // bottom left
                    -featurePotionBaseWidth, -featurePotionBaseHeight, featurePotionBaseWidth,
                    // middle left
                    -featurePotionNeckWidth, 0, featurePotionNeckWidth,

                    // right

                    // top back
                    featurePotionNeckWidth, featurePotionNeckHeight, featurePotionNeckWidth,
                    // top front
                    featurePotionNeckWidth, featurePotionNeckHeight, -featurePotionNeckWidth,
                    // middle right
                    featurePotionNeckWidth, 0, -featurePotionNeckWidth,
                    // bottom right
                    featurePotionBaseWidth, -featurePotionBaseHeight, -featurePotionBaseWidth,
                    // bottom left
                    featurePotionBaseWidth, -featurePotionBaseHeight, featurePotionBaseWidth,
                    // middle left
                    featurePotionNeckWidth, 0, featurePotionNeckWidth,

                    // back

                    // top left
                    featurePotionNeckWidth, featurePotionNeckHeight, -featurePotionNeckWidth,
                    // top right
                    -featurePotionNeckWidth, featurePotionNeckHeight, -featurePotionNeckWidth,
                    // middle right
                    -featurePotionNeckWidth, 0, -featurePotionNeckWidth,
                    // bottom right
                    -featurePotionBaseWidth, -featurePotionBaseHeight, -featurePotionBaseWidth,
                    // bottom left
                    featurePotionBaseWidth, -featurePotionBaseHeight, -featurePotionBaseWidth,
                    // middle left
                    featurePotionNeckWidth, 0, -featurePotionNeckWidth,

                    // left
                    // top left
                    -featurePotionNeckWidth, featurePotionNeckHeight, -featurePotionNeckWidth,
                    // top right
                    -featurePotionNeckWidth, featurePotionNeckHeight, featurePotionNeckWidth,
                    // middle right
                    -featurePotionNeckWidth, 0, featurePotionNeckWidth,
                    // bottom right
                    -featurePotionBaseWidth, -featurePotionBaseHeight, featurePotionBaseWidth,
                    // bottom left
                    -featurePotionBaseWidth, -featurePotionBaseHeight, -featurePotionBaseWidth,
                    // middle left
                    -featurePotionNeckWidth, 0, -featurePotionNeckWidth,

                ];

                let featurePotionNormals = [
                    // front

                    // top left
                    0, 0, 1,
                    // top right
                    0, 0, 1,
                    // middle right
                    0, 0, 1,
                    // bottom right
                    0, 0, 1,
                    // bottom left
                    0, 0, 1,
                    // middle left
                    0, 0, 1,

                    // right

                    // top back
                    1, 0, 0,
                    // top front
                    1, 0, 0,
                    // middle right
                    1, 0, 0,
                    // bottom right
                    1, 0, 0,
                    // bottom left
                    1, 0, 0,
                    // middle left
                    1, 0, 0,

                    // back

                    // top left
                    0, 0, -1,
                    // top right
                    0, 0, -1,
                    // middle right
                    0, 0, -1,
                    // bottom right
                    0, 0, -1,
                    // bottom left
                    0, 0, -1,
                    // middle left
                    0, 0, -1,

                    // left
                    // top left
                    -1, 0, 0, 
                    // top right
                    -1, 0, 0, 
                    // middle right
                    -1, 0, 0, 
                    // bottom right
                    -1, 0, 0, 
                    // bottom left
                    -1, 0, 0, 
                    // middle left
                    -1, 0, 0, 

                    // TODO probably want normals for top and bottom
                ];

                let featurePotionIndices = [
                    // front
                    0, 2, 1,
                    0, 5, 2,
                    5, 3, 2,
                    3, 5, 4,

                    //right
                    6, 8, 7,
                    6, 11, 8,
                    11, 9, 8,
                    9, 11, 10,

                    // back
                    12, 14, 13,
                    12, 17, 14,
                    17, 15, 14,
                    15, 17, 16,

                    // left
                    18, 20, 19,
                    18, 23, 20,
                    23, 21, 20,
                    21, 23, 22,

                    // top
                    0, 6, 12,
                    18, 0, 12,

                    // base
                    4, 22, 10,
                    10, 22, 16
                ];

                let featurePotionTextureCoordinates = [];
                countForEach(4, function () {
                    featurePotionTextureCoordinates.push(
                        0, 0,
                        1, 0,
                        1, .5,
                        1, 1,
                        0, 1,
                        0, .5
                    );
                });

                featurePotionRenderParams = shapeRenderInit(
                    gl,
                    shaderProgram,
                    featurePotionVertices,
                    featurePotionNormals,
                    featurePotionIndices,
                    featurePotionTextureCoordinates
                );

                resize();
                redraw();
                redrawInventory();

                // kick off the action
                let t = performance.now();
                update(t);

                let animationCallback = function (t: number) {
                    animationFrameRequest = requestAnimationFrame(animationCallback);
                    animate(t);
                };
                animationCallback(t);
                if (!updateAnimation) {
                    updateAnimation = consume(t, queuedLevelDeltas);
                }
            },

            destroyState: function(): void {
                cancelAnimationFrame(animationFrameRequest);

                stateDefaultDestroy.apply(playState);
                arrayForEach(textures, function (texture: WebGLTexture) {
                    if (texture) {
                        context.deleteTexture(texture);
                    }
                });
                context = null;
            }
        }

        return playState;
    }

}
