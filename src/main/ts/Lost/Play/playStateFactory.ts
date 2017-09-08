///<reference path="../State.ts"/>
///<reference path="../Util/createElement.ts"/>

function playStateFactory(gameService: GameService, levelPopulator: LevelPopulator): StateFactory {
    return function(stateTypeId: StateTypeId, data: PlayStateData): State {

        let game = data.game;

        let levelId: LevelId;
        if (data.playerTransition) {
            levelId = data.playerTransition.entryLocation.levelId;
        } else {
            levelId = game.playerLevelId;
        }
        let level = gameService.getLevel(game, levelId);
        if (!level) {
            // need to create a level
            let rng = trigRandomNumberGeneratorFactory(game.randomNumberSeed + levelId * 999);
            let squareSide = 7 + (levelId>>1);
            let area = squareSide * squareSide + levelId;
            let width = squareSide + rng(squareSide/4) - rng(squareSide/4);
            let height = ceil(area / width);
            let tiles = create2DArray(width, height, function (x: number, y: number) {
                /*
                let name: string;
                if (x == startX && y == startY && data.playerTransition) { 
                    name = data.playerTransition.location.tileName;
                }
                let type: TileType;
                if (x == 2 && y == 2) {
                    type = TILE_TYPE_SOLID;
                } else {
                    type = TILE_TYPE_FLOOR;
                }
                */
                /*
                let dice: Dice = {
                    diceId: game.nextEntityId++,
                    level: rng(5),
                    symbols: [
                        [DICE_SYMBOL_ATTACK],
                        [DICE_SYMBOL_ATTACK, DICE_SYMBOL_DEFEND, DICE_SYMBOL_RESOURCE_FIRE, DICE_SYMBOL_RESOURCE_FIRE],
                        [DICE_SYMBOL_DEFEND],
                        [DICE_SYMBOL_RESOURCE_FIRE, DICE_SYMBOL_RESOURCE_FIRE, DICE_SYMBOL_RESOURCE_FIRE, DICE_SYMBOL_RESOURCE_FIRE],
                        [DICE_SYMBOL_RESOURCE_LIFE, DICE_SYMBOL_RESOURCE_LIFE, DICE_SYMBOL_RESOURCE_LIFE],
                        [DICE_SYMBOL_RESOURCE_FIRE, DICE_SYMBOL_RESOURCE_LIFE, DICE_SYMBOL_RESOURCE_WATER, DICE_SYMBOL_DEFEND]
                    ],
                    type: rng(4)
                }
                */
                let tile: Tile = {
                    type: TILE_TYPE_SOLID,
                    dice: {}
                };
                return tile;
            });
            let features: Feature[] = [
                {
                    type: FEATURE_TYPE_ENTRANCE,
                    name: ''+levelId+'1'
                },
                {
                    type: FEATURE_TYPE_EXIT,
                    name: ''+(levelId+1)+'1'
                }
            ];

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
                if (tile.name == data.playerTransition.entryLocation.tileName) {
                    tileX = x;
                    tileY = y;
                }
            });
            tile = level.tiles[tileX][tileY];
            viewer = data.playerTransition.entity;
            tile.entity = viewer;
            // orient player to open space
            arrayForEach(ORIENTATION_DIFFS, function (diff: Point, orientation: Orientation) {
                let tx = tileX + diff.x;
                let ty = tileY + diff.y;
                if (tx >= 0 && ty >= 0 && tx < level.levelWidth && ty < level.levelHeight) {
                    let t = level.tiles[tx][ty];
                    if (t.type != TILE_TYPE_SOLID) {
                        viewer.entityOrientation = orientation;
                    }
                }
            });


            queuedLevelDeltas = [{
                type: LEVEL_DELTA_TYPE_DROP_IN,
                data: {
                    entity: viewer
                }
            }];
        } else {
            let tile = levelFindTile(level, function (tile: Tile) {
                return tile.entity && tile.entity.behaviorType == BEHAVIOR_TYPE_PLAYER;
            });
            viewer = tile.entity;
        }

        console.log('level ' + levelId);
        for (let y = 0; y < level.levelHeight; y++) {
            let s = '' + y + ':';
            for (let x = 0; x < level.levelWidth; x++) {
                let tile = level.tiles[x][y];
                if (tile.name) {
                    s += tile.name;
                } else {
                    s += tile.type == TILE_TYPE_SOLID ? '#' : (tile.type == TILE_TYPE_FLOOR ? '.' : tile.type.toString());
                }

            }
            console.log(s);
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
        let halfDiceSize = .06;
        let healthRenderParams: ShapeRenderParams;

        let textures: WebGLTexture[] = [];

        let queuedStateChangeData: LevelDeltaDataChangeState;

        let levelUpdater = createLevelUpdater(game, level);
        let canvas: HTMLCanvasElement = <HTMLCanvasElement>getElementById('c');
        let inventory: HTMLDivElement = <HTMLDivElement>getElementById('i');
        let status: HTMLDivElement = <HTMLDivElement>getElementById('s');

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
            // set up the offscreen rendering
            let gl = context;
            let offscreenFramebufferWidth = canvas.clientWidth;
            let offscreenFramebufferHeight = canvas.clientHeight;

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
        
            draw(<any>1);


            var pixels = new Uint8Array(4);
            gl.readPixels(x, offscreenFramebufferHeight - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            let id = 0;
            countForEach(3, function (i: number) {
                id = (id << 8) | pixels[i];
            });

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
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);


            // find the dice with that id
            levelFindTile(level, function (tile: Tile, x: number, y: number) {
                let result;
                for (let position in tile.dice) {
                    let diceAndFace = tile.dice[position];
                    if (diceAndFace) {
                        result = diceAndFace.dice.diceId == id;
                        if (result) {
                            queueInput({
                                type: INPUT_TYPE_COLLECT_DICE,
                                data: {
                                    diceId: id,
                                    tileX: x,
                                    tileY: y,
                                    position: position
                                }
                            });
                            return result;
                        }
                    }
                }
                let entity = tile.entity;
                let input: Input = {
                    type: INPUT_TYPE_NONE
                };
                if (entity) {
                    for (let dice of entity.dice) {
                        let result = dice && dice.diceId == id;
                        if (result) {
                            input = {
                                type: INPUT_TYPE_PLAY_DICE,
                                data: {
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


            gl.deleteFramebuffer(offscreenFramebuffer);
            gl.deleteTexture(offscreenTexture);
            gl.deleteRenderbuffer(offscreenRenderbuffer);

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
                            levelDeltaAnimations.push(animation);
                        } 
                    });
                    switch (levelDelta.type) {
                        case LEVEL_DELTA_TYPE_DIE:
                            let dieData = <LevelDeltaDataDie>levelDelta.data;
                            delete entityRenders[dieData.entity.id];
                            break;
                        case LEVEL_DELTA_TYPE_CHANGE_STATE:
                            queuedStateChangeData = <LevelDeltaDataChangeState>levelDelta.data;
                            break;
                    }
                    let levelDeltaAnimation = animationCompositeFactory(levelDeltaAnimations);
                    if (levelDelta.children) {
                        levelDeltaAnimation = animationChainedProxyFactory(
                            levelDeltaAnimation,
                            function (t: number) {
                                return consume(t, levelDelta.children);
                            }
                        );
                    }
                    animations.push(levelDeltaAnimation);
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
            var levelUpdate = levelUpdater.update();
            // are they dead?
            game.inactive = viewer.dead;
            // save the changes
            gameService.saveLevel(game, level);

            // animate the update
            updateAnimation = consume(t, levelUpdate.deltas);

            if (!updateAnimation) {
                if (!levelUpdate.awaitingInput) {
                    update(t);
                }
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
            let rng = trigRandomNumberGeneratorFactory(game.randomNumberSeed + level.levelId);

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
            textures.push(blankTexture);

            updateAnimation = null;
            entityRenders = {};
            create2DArray(level.levelWidth, level.levelHeight, function (x: number, y: number, tileRenders2: Render[][]) {
                tileRenders = tileRenders2;
                let tile = level.tiles[x][y];
                let childRenders: { [_: string]: Render } = {};

                if (tile.type != TILE_TYPE_SOLID) {
                    let hole = tile.type == TILE_TYPE_ROOFLESS || tile.type == TILE_TYPE_PIT;
                    let wallTexture1 = webglCanvasToTexture(gl, createRepeatingBrickPattern(rng, textureDimension, textureDimension, bricksAcross, bricksDown, .5, 0, colors.wallUpper, colors.wallLower, brickRounding, groutWidth, colors.grout, hole ? ['▲'] : nil));
                    let wallTexture2 = webglCanvasToTexture(gl, createRepeatingBrickPattern(rng, textureDimension, textureDimension, bricksAcross, bricksDown, .5, .5, colors.wallUpper, colors.wallLower, brickRounding, groutWidth, colors.grout, hole ? ['▼'] : nil));
                    if (x == 0 || level.tiles[x - 1][y].type == TILE_TYPE_SOLID) {
                        // add a wall to the west
                        childRenders['w'] = shapeRenderFactory([matrixTranslate4(-.5, .5, 0), matrixRotateZ4(piOn2), matrixRotateY4(piOn2)], surfaceRenderParams, wallTexture1, blankTexture);
                    }
                    if (x == level.levelWidth - 1 || level.tiles[x + 1][y].type == TILE_TYPE_SOLID) {
                        // add a wall to the west
                        childRenders['e'] = shapeRenderFactory([matrixTranslate4(.5, .5, 0), matrixRotateZ4(-piOn2), matrixRotateY4(-piOn2)], surfaceRenderParams, wallTexture1, blankTexture);
                    }
                    if (y == 0 || level.tiles[x][y - 1].type == TILE_TYPE_SOLID) {
                        // add a wall to the west
                        childRenders['n'] = shapeRenderFactory([matrixTranslate4(0, .5, -.5), matrixRotateX4(-piOn2)], surfaceRenderParams, wallTexture2, blankTexture);
                    }
                    if (y == level.levelHeight - 1 || level.tiles[x][y + 1].type == TILE_TYPE_SOLID) {
                        // add a wall to the west
                        childRenders['s'] = shapeRenderFactory([matrixTranslate4(0, .5, .5), matrixRotateX4(piOn2), matrixRotateY4(pi)], surfaceRenderParams, wallTexture2, blankTexture);
                    }
                    // add a floor
                    let floorTexture = webglCanvasToTexture(gl, createRepeatingBrickPattern(rng, textureDimension, textureDimension, 1, 1, 0, 0, colors.floor, colors.floor, brickRounding * 4, groutWidth * 3, colors.grout, tile.type == TILE_TYPE_ROOFLESS ? [<any>level.levelId] : nil));
                    if (tile.type == TILE_TYPE_PIT) {
                        childRenders['W'] = shapeRenderFactory([matrixTranslate4(.5, -.5, 0), matrixRotateZ4(-piOn2), matrixRotateY4(piOn2)], surfaceRenderParams, wallTexture2);
                        childRenders['E'] = shapeRenderFactory([matrixTranslate4(-.5, -.5, 0), matrixRotateZ4(piOn2), matrixRotateY4(-piOn2)], surfaceRenderParams, wallTexture2);
                        childRenders['N'] = shapeRenderFactory([matrixTranslate4(0, -.5, .5), matrixRotateX4(piOn2)], surfaceRenderParams, wallTexture1);
                        childRenders['S'] = shapeRenderFactory([matrixTranslate4(0, -.5, -.5), matrixRotateX4(-piOn2), matrixRotateY4(pi)], surfaceRenderParams, wallTexture1);
                    } else {
                        childRenders['f'] = shapeRenderFactory([matrixRotateY4(pi / 2 * rng(4))], surfaceRenderParams, floorTexture);
                    }
                    let ceilingTexture = webglCanvasToTexture(gl, createRepeatingBrickPattern(rng, textureDimension, textureDimension, roofTilesAcross, roofTilesDown, 1 / (rng(roofTilesAcross) + 1), 0, colors.wallUpper, colors.wallUpper, brickRounding, groutWidth, colors.grout));
                    if (tile.type == TILE_TYPE_ROOFLESS) {
                        childRenders['W'] = shapeRenderFactory([matrixTranslate4(.5, 1.5, 0), matrixRotateZ4(-piOn2), matrixRotateY4(piOn2)], surfaceRenderParams, wallTexture2);
                        childRenders['E'] = shapeRenderFactory([matrixTranslate4(-.5, 1.5, 0), matrixRotateZ4(piOn2), matrixRotateY4(-piOn2)], surfaceRenderParams, wallTexture2);
                        childRenders['N'] = shapeRenderFactory([matrixTranslate4(0, 1.5, .5), matrixRotateX4(piOn2)], surfaceRenderParams, wallTexture1);
                        childRenders['S'] = shapeRenderFactory([matrixTranslate4(0, 1.5, -.5), matrixRotateX4(-piOn2), matrixRotateY4(pi)], surfaceRenderParams, wallTexture1);
                    } else {
                        childRenders['c'] = shapeRenderFactory([matrixTranslate4(0, 1, 0), matrixRotateX4(pi)], surfaceRenderParams, ceilingTexture);
                    }
                    textures.push(wallTexture1, wallTexture2, ceilingTexture, floorTexture);
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
                    let slot: TileSlot = TILE_SLOTS_ALL[key];
                    let render = createRestingTileDiceRender(diceAndFace.dice, slot.dx, slot.dy, diceAndFace.face, slot.rotation);
                    childRenders[key] = render;
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
                let cameraPosition = matrixInvert4(cameraEntityRender.position);
                let cameraRotation = matrixInvert4(cameraEntityRender.rotation);
                let transformStack: Matrix4[] = [
                    cameraProjectionMatrix,
                    cameraEntityRender.facing,
                    cameraRotation,
                    cameraPosition
                ];

                levelFindTile(level, function (tile: Tile, x: number, y: number) {
                    let tileRender = tileRenders[x][y];
                    tileRender.draw(gl, transformStack, usePickTextures);
                });

                mapForEach(entityRenders, function (key: string, entityRender: Render) {
                    entityRender.draw(gl, transformStack, usePickTextures);
                });

            }
        }

        function createEntityRender(entity: Entity, x: number, y: number): EntityRender {
            let rotation = matrixRotateY4(ORIENTATION_ANGLES[entity.entityOrientation]);
            let position = matrixTranslate4(x, .5, y);

            let diceRenders: { [_: string]: Render } = {};
            arrayForEach(entity.dice, function (dice: Dice, index: number) {
                if (dice) {
                    let diceRender = createEntityDiceRender(dice, index, entity.dice.length);
                    diceRenders[dice.diceId] = diceRender;
                }
            });
            let healthCount = entity.healthSlots;
            let healthRenders: Render[] = [];
            while (healthCount) {
                healthCount--;
                let healthRender = createHealthRender(healthCount, entity.healthSlots);
                healthRenders.push(healthRender);
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
                levelUpdater.getEffectiveHealth(entity)
            );
        }

        function createHealthRender(index: number, count: number): Render {
            let rng = function() {
                return 0;
            };

            let canvas = createRepeatingBrickPattern(rng, 32, 64, 1, 2, 0, 0, '#aaa', '#fd0', 0, 0, '#fff', [' ','♥']);

            let texture = webglCanvasToTexture(context, canvas);
            textures.push(texture);
            let transforms: Matrix4[] = [];

            return shapeRenderFactory(transforms, healthRenderParams, texture);
        }

        function createDiceRender(dice: Dice, transformations: Matrix4[]): Render {
            let canvas = createDiceTexture(512, 256, diceTextureCoordinates, dice);
            let texture = webglCanvasToTexture(context, canvas);
            textures.push(texture);

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
                let canvas = renderToCanvas(healthRender, dimension, dimension, halfDiceSize, pi/5, pi/4);
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
                    t += '●';
                    value--;
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
                    let diceRender = render.diceRenders[dice.diceId];
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
                            type: INPUT_TYPE_PLAY_DICE,
                            data: data
                        });
                    };

                    slotRender.appendChild(canvas);
                }
            });
        }

        function renderToCanvas(render: Render, canvasWidth: number, canvasHeight: number, halfObjectSize: number, rotateX: number, rotateY: number): HTMLCanvasElement {

            let canvas = createCanvas(canvasWidth, canvasHeight);

            let gl = context;
            let offscreenFramebufferWidth = canvasWidth;
            let offscreenFramebufferHeight = canvasHeight;

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
            gl.viewport(0, 0, canvasWidth, canvasHeight);

            //let perspective = cameraProjectionMatrix;
            //cameraProjectionMatrix = matrixPerspective4(pi / 3, canvasWidth / canvasHeight, .1, 100)

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
                projection,
                matrixTranslate4(canvasWidth / 2, canvasHeight / 2, -50),
                scaleMatrix,
                matrixRotateX4(rotateX),
                matrixRotateY4(rotateY),
            
            ];
            let oldTransforms = render.localTransforms;
            render.localTransforms = [];
            render.draw(gl, transformStack, <any>0);
            render.localTransforms = oldTransforms;
            //draw(gl);
            //cameraProjectionMatrix = perspective;

            var pixels = new Uint8Array(4 * offscreenFramebufferWidth * offscreenFramebufferHeight);
            gl.readPixels(0, 0, offscreenFramebufferWidth, offscreenFramebufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            var context2d = canvas.getContext('2d');

            // Copy the pixels to a 2D canvas
            var imageData = context2d.createImageData(offscreenFramebufferWidth, offscreenFramebufferHeight);
            imageData.data.set(pixels);
            context2d.putImageData(imageData, 0, 0);

            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            // reset the viewport (shorter than calling viewport method directly!)
            resize();

            return canvas;
        }

        var playState: State = {
            elementId: 'p',
            init: function(stateListener: StateListener) {

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
                        switch (e.keyCode) {
                            // left
                            case 37:
                            // a
                            case 65:
                                type = INPUT_TYPE_TURN_LEFT;
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
                                type = INPUT_TYPE_TURN_RIGHT;
                                break;
                            // down
                            case 40:
                            // s
                            case 83:
                                type = INPUT_TYPE_LOOK_DOWN;
                                break;
                        }
                        queueInput({
                            type: type
                        });
                    },
                    'click': function (e: MouseEvent) {
                        handleSelect(e.x, e.y);
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
                                    if (abs(xDiff) < abs(yDiff)) {
                                        // swipe vertically
                                        if (yDiff > 0) {
                                            type = INPUT_TYPE_MOVE_FORWARD;
                                        } else {
                                            type = INPUT_TYPE_LOOK_DOWN;
                                        }
                                    } else {
                                        // swipe horizontally
                                        if (xDiff > 0) {
                                            type = INPUT_TYPE_TURN_LEFT;
                                        } else {
                                            type = INPUT_TYPE_TURN_RIGHT;
                                        }
                                    }
                                    queueInput({
                                        type: type
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

                if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
                    throw new Error();
                }

                gl.useProgram(shaderProgram);

                let surfaceVertices = [
                    .5, 0, .5,
                    -.5, 0, .5,
                    .5, 0, -.5,
                    -.5, 0, -.5
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
                let diceIndices = [
                    0, 1, 2, 0, 2, 3,    // front
                    4, 5, 6, 4, 6, 7,    // back
                    8, 9, 10, 8, 10, 11,   // top
                    12, 13, 14, 12, 14, 15,   // bottom
                    16, 17, 18, 16, 18, 19,   // right
                    20, 21, 22, 20, 22, 23,   // left
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
                    diceIndices,
                    diceTextureCoordinates
                );
                let healthRadius = .08;
                let halfHealthHeight = .09;
                let healthVertices = [
                    // top
                    0, halfHealthHeight, 0,
                    // north
                    0, 0, healthRadius,
                    // east
                    healthRadius, 0, 0,
                    // south
                    0, 0, -healthRadius,
                    // west
                    -healthRadius, 0, 0,
                    // bottom
                    0, -halfHealthHeight, 0
                ];
                let healthIndices = [
                    0, 1, 2, // top north east
                    0, 2, 3, // top east south
                    0, 3, 4, // top south west
                    0, 4, 1, // top west north
                    5, 2, 1, // bottom east north 
                    5, 3, 2, // bottom south east
                    5, 4, 3, // bottom west south
                    5, 1, 4 // bottom north west
                ];
                let healthTextureCoordinates = [
                    .5, 0, // top
                    0, 1, // north
                    1, 1, // east
                    0, 1, // south
                    1, 1, // west
                    .5, 0 // bottom
                ];
                healthRenderParams = shapeRenderInit(
                    gl,
                    shaderProgram,
                    healthVertices,
                    healthIndices,
                    healthTextureCoordinates
                )

                resize();
                redraw();
                redrawInventory();
            },

            start: function() {
                draw();
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

            stop: function() {
                cancelAnimationFrame(animationFrameRequest);
            },

            destroy: function(): void {
                stateDefaultDestroy.apply(playState);
                arrayForEach(textures, function (texture: WebGLTexture) {
                    context.deleteTexture(texture);
                });
                context = null;
            }
        }

        return playState;
    }

}
