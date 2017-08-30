///<reference path="../State.ts"/>

class PlayState extends State<HTMLCanvasElement> {

    tileRenders: Render[][];
    entityRenders: { [_: number]: EntityRender };
    cameraEntityRender: EntityRender;
    context: WebGLRenderingContext;

    //private cameraPositionMatrix: Matrix4;
    private cameraProjectionMatrix: Matrix4;
    private levelUpdater: LevelUpdater;

    private updateAnimation: Animation;
    private animationFrameRequest: number;

    private surfaceRenderParams: ShapeRenderParams;
    private diceTextureCoordinates: number[];
    private diceRenderParams: ShapeRenderParams;
    private halfDiceSize: number;

    private healthBuffer: WebGLBuffer;

    private textures: WebGLTexture[] = [];

    private queuedStateChangeData: LevelDeltaDataChangeState;

    constructor(private gameService: GameService, private game: Game, private level: Level, private viewerEntity: Entity, private queuedLevelDeltas: LevelDelta[]) {
        super('p');
        this.levelUpdater = new LevelUpdater(this.game, this.level);
    }

    queueInput(input: Input) {
        let updateNow = this.levelUpdater.queueInput(input);
        if (updateNow) {
            this.update(performance.now());
        }
    }

    handleSelect(x: number, y: number) {
        // set up the offscreen rendering
        let gl = this.context;
        let offscreenFramebufferWidth = this.element.clientWidth;
        let offscreenFramebufferHeight = this.element.clientHeight;

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
        
        this.draw(gl, <any>1);

        let pixels = new Uint8Array(4);
        gl.readPixels(x, offscreenFramebufferHeight - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let id = 0;
        for (let i= 0; i < 3; i++ ) {
            id = (id << 8) | pixels[i];
        }

        // find the dice with that id
        levelFindTile(this.level, (tile: Tile, x: number, y: number) => {
            let result;
            for (let position in tile.dice) {
                let diceAndFace = tile.dice[position];
                result = diceAndFace.dice.diceId == id;
                if (result) {
                    this.levelUpdater.queueInput({
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
            let entity = tile.entity;
            if (entity) {
                for (let dice of entity.dice) {
                    let result = dice.diceId == id;
                    if (result) {
                        this.levelUpdater.queueInput({
                            type: INPUT_TYPE_PLAY_DICE,
                            data: {
                                diceId: id,
                                owner: entity
                            }
                        });
                        return result;
                    }
                }
            }
        });

        /*
        let pixels = new Uint8Array(4 * offscreenFramebufferWidth * offscreenFramebufferHeight);
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

        gl.deleteFramebuffer(offscreenFramebuffer);
        gl.deleteTexture(offscreenTexture);
        gl.deleteRenderbuffer(offscreenRenderbuffer);
    }

    init(stateListener: StateListener): void {
        let xDown;
        let yDown;
        let timeDown;
        let xDiff;
        let yDiff;

        let eventListeners = {
            resize: () => {
                this.resize();
            },
            keydown: (e: KeyboardEvent) => {
                let type: InputType;
                switch (e.keyCode) {
                    case 37:
                        type = INPUT_TYPE_TURN_LEFT;
                        break;
                    case 38:
                        type = INPUT_TYPE_MOVE_FORWARD;
                        break;
                    case 39:
                        type = INPUT_TYPE_TURN_RIGHT;
                        break;
                    case 40:
                        type = INPUT_TYPE_LOOK_DOWN;
                        break;
                }
                this.queueInput({
                    type: type
                });
            },
            click: (e: MouseEvent) => {
                this.handleSelect(e.x, e.y);
            },
            touchstart: (e: TouchEvent) => {
                let touch = e.touches[0];
                xDown = touch.clientX;
                yDown = touch.clientY;
                xDiff = 0;
                yDiff = 0;
                timeDown = e.timeStamp;
                e.preventDefault();
            },
            touchmove: (e: TouchEvent) => {
                let touch = e.touches[0];
                xDiff = touch.clientX - xDown;
                yDiff = touch.clientY - yDown;
            },
            touchend: (e: TouchEvent) => {
                let timeDiff = e.timeStamp - timeDown;

                if (timeDiff < 400) {
                    if (Math.abs(xDiff) + Math.abs(yDiff) < 50) {
                        // click
                        this.handleSelect(xDown, yDown);
                    } else {
                        let type: InputType;
                        if (Math.abs(xDiff) < Math.abs(yDiff)) {
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
                        this.queueInput({
                            type: type
                        });
                    }
                }
            }
        };
        super.init(stateListener, eventListeners);

        this.context = this.element.getContext('webgl');

        let gl = this.context;

        gl.clearColor(0, 0, 0, 1);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.CULL_FACE);

        // set up the shaders
        var fragmentShader = webglGetShader(gl, ShapeRender.fragmentShaderScript, gl.FRAGMENT_SHADER);
        var vertexShader = webglGetShader(gl, ShapeRender.vertexShaderScript, gl.VERTEX_SHADER);

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

        this.resize();

        let surfaceVertices = [
            0.5, 0, 0.5,
            -0.5, 0, 0.5,
            0.5, 0, -0.5,
            -0.5, 0, -0.5
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
        this.surfaceRenderParams = ShapeRender.init(
            gl,
            shaderProgram,
            surfaceVertices,
            surfaceIndices,
            surfaceTextureCoordinates
        );

        let halfDiceSize = .06;
        this.halfDiceSize = halfDiceSize;
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
        let diceTextureCoordinates = [
            // Front
            0.0, 0.0,
            0.25, 0.0,
            0.25, 0.5,
            0.0, 0.5,
            // Back
            0.25, 0.0,
            0.5, 0.0,
            0.5, 0.5,
            0.25, 0.5,
            // Top
            0.5, 0.0,
            0.75, 0.0,
            0.75, 0.5,
            0.5, 0.5,
            // Bottom
            0.0, 0.5,
            0.25, 0.5,
            0.25, 1.0,
            0.0, 1.0,
            // Right
            0.25, 0.5,
            0.5, 0.5,
            0.5, 1.0,
            0.25, 1.0,
            // Left
            0.5, 0.5,
            0.75, 0.5,
            0.75, 1.0,
            0.5, 1.0
        ];
        this.diceTextureCoordinates = diceTextureCoordinates;
        this.diceRenderParams = ShapeRender.init(
            gl,
            shaderProgram,
            diceVertices,
            diceIndices,
            diceTextureCoordinates
        );

        this.healthBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.healthBuffer);
        let healthVertices = [
            0.5, 0.5, 0,
            -0.5, 0.5, 0,
            -0.5, 0, 0,
            0.5, 0, 0
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(healthVertices), gl.STATIC_DRAW);

        this.redraw();
    }

    start() {
        this.draw(this.context);
        // kick off the action
        let t = performance.now();
        this.update(t);

        let animate = (t: number) => {
            this.animationFrameRequest = requestAnimationFrame(animate);
            this.animate(t);
        };
        animate(t);
        if (!this.updateAnimation) {
            this.updateAnimation = this.consume(t, this.queuedLevelDeltas);
        }
    }

    stop() {
        cancelAnimationFrame(this.animationFrameRequest);
    }

    destroy(): void {
        super.destroy();
        for (let texture of this.textures) {
            this.context.deleteTexture(texture);
        }
        this.context = null;
    }


    consume(t: number, levelDeltas: LevelDelta[]): Animation {
        let animation: Animation;
        if (levelDeltas) {
            let animations: Animation[] = [];
            for (let levelDelta of levelDeltas) {
                for (let entityId in this.entityRenders) {
                    let entityRender = this.entityRenders[entityId];
                    let animation = entityRender.consume(t, levelDelta);
                    if (animation) {
                        if (levelDelta.children) {
                            animation = animationChainedProxyFactory(
                                animation,
                                (t: number, levelDeltas: LevelDelta[]) => {
                                    return this.consume(t, levelDeltas);
                                },
                                levelDelta.children
                            );
                        }
                        animations.push(animation);
                    }
                }
                switch (levelDelta.type) {
                    case LEVEL_DELTA_TYPE_DIE:
                        let dieData = <LevelDeltaDataDie>levelDelta.data;
                        delete this.entityRenders[dieData.entity.id];
                        break;
                    case LEVEL_DELTA_TYPE_CHANGE_STATE:
                        this.queuedStateChangeData = <LevelDeltaDataChangeState>levelDelta.data;
                        break;
                }
            }
            if (animations.length) {
                animation = animationCompositeFactory(animations);
            }
        }
        return animation;
    }

    animate(t: number) {
        if (this.updateAnimation) {
            let running = this.updateAnimation(t);
            if (!running) {
                this.updateAnimation = null;
                this.update(t);
            }
        }
        for (let entityId in this.entityRenders) {
            let entityRender = this.entityRenders[entityId];
            entityRender.update(t);
        }
        this.draw(this.context);
        if (this.queuedStateChangeData) {
            this.stateListener(this.queuedStateChangeData.stateTypeId, this.queuedStateChangeData.stateData);
        }
    }

    update(t: number) {
        var levelUpdate = this.levelUpdater.updateLevel();
        // save the changes
        this.gameService.saveLevel(this.game, this.level);
        // animate the update
        this.updateAnimation = this.consume(t, levelUpdate.deltas);

        if (!this.updateAnimation) {
            if (levelUpdate.awaitingInput) {
                //this.redraw();
            } else {
                this.update(t);
            }
        }
    }

    resize() {
        let width = this.element.clientWidth;
        let height = this.element.clientHeight;

        this.element.width = width;
        this.element.height = height;

        this.context.viewport(0, 0, width, height);
        this.cameraProjectionMatrix = matrixPerspective4(pi / 3, width / height, 0.1, 100.0);

    }

    redraw() {
        let gl = this.context;
        let rng = trigRandomNumberGeneratorFactory(this.game.randomNumberSeed + this.level.levelId * 999);

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
        this.textures.push(blankTexture);

        this.updateAnimation = null;
        this.entityRenders = {};
        this.tileRenders = create2DArray(this.level.width, this.level.height, (x: number, y: number) => {
            let tile = this.level.tiles[x][y];
            let childRenders: { [_: string]: Render } = {};

            if (tile.type != TILE_TYPE_SOLID) {
                let hole = tile.type == TILE_TYPE_ROOFLESS || tile.type == TILE_TYPE_PIT;
                let wallTexture1 = webglCanvasToTexture(gl, createRepeatingBrickPattern(rng, textureDimension, textureDimension, bricksAcross, bricksDown, 0.5, 0, colors.wallUpper, colors.wallLower, brickRounding, groutWidth, colors.grout, hole ? ['▲'] : nil));
                let wallTexture2 = webglCanvasToTexture(gl, createRepeatingBrickPattern(rng, textureDimension, textureDimension, bricksAcross, bricksDown, 0.5, 0.5, colors.wallUpper, colors.wallLower, brickRounding, groutWidth, colors.grout, hole ? ['▼'] : nil));
                if (x == 0 || this.level.tiles[x - 1][y].type == TILE_TYPE_SOLID) {
                    // add a wall to the west
                    childRenders['w'] = new ShapeRender([matrixTranslate4(-0.5, 0.5, 0), matrixRotateZ4(Math.PI / 2), matrixRotateY4(Math.PI / 2)], this.surfaceRenderParams, wallTexture1, blankTexture);
                }
                if (x == this.level.width - 1 || this.level.tiles[x + 1][y].type == TILE_TYPE_SOLID) {
                    // add a wall to the west
                    childRenders['e'] = new ShapeRender([matrixTranslate4(0.5, 0.5, 0), matrixRotateZ4(-Math.PI / 2), matrixRotateY4(-Math.PI / 2)], this.surfaceRenderParams, wallTexture1, blankTexture);
                }
                if (y == 0 || this.level.tiles[x][y - 1].type == TILE_TYPE_SOLID) {
                    // add a wall to the west
                    childRenders['n'] = new ShapeRender([matrixTranslate4(0, 0.5, -0.5), matrixRotateX4(-Math.PI / 2)], this.surfaceRenderParams, wallTexture2, blankTexture);
                }
                if (y == this.level.height - 1 || this.level.tiles[x][y + 1].type == TILE_TYPE_SOLID) {
                    // add a wall to the west
                    childRenders['s'] = new ShapeRender([matrixTranslate4(0, 0.5, 0.5), matrixRotateX4(Math.PI / 2), matrixRotateY4(Math.PI)], this.surfaceRenderParams, wallTexture2, blankTexture);
                }
                // add a floor
                let floorTexture = webglCanvasToTexture(gl, createRepeatingBrickPattern(rng, textureDimension, textureDimension, 1, 1, 0, 0, colors.floor, colors.floor, brickRounding * 4, groutWidth * 3, colors.grout, tile.type == TILE_TYPE_ROOFLESS ? [<any>this.level.levelId] : nil));
                if (tile.type == TILE_TYPE_PIT) {
                    childRenders['W'] = new ShapeRender([matrixTranslate4(0.5, -0.5, 0), matrixRotateZ4(-Math.PI / 2), matrixRotateY4(Math.PI / 2)], this.surfaceRenderParams, wallTexture2);
                    childRenders['E'] = new ShapeRender([matrixTranslate4(-0.5, -0.5, 0), matrixRotateZ4(Math.PI / 2), matrixRotateY4(-Math.PI / 2)], this.surfaceRenderParams, wallTexture2);
                    childRenders['N'] = new ShapeRender([matrixTranslate4(0, -0.5, 0.5), matrixRotateX4(Math.PI / 2)], this.surfaceRenderParams, wallTexture1);
                    childRenders['S'] = new ShapeRender([matrixTranslate4(0, -0.5, -0.5), matrixRotateX4(-Math.PI / 2), matrixRotateY4(Math.PI)], this.surfaceRenderParams, wallTexture1);
                } else {
                    childRenders['f'] = new ShapeRender([matrixRotateY4(pi / 2 * rng(4))], this.surfaceRenderParams, floorTexture);
                }
                let ceilingTexture = webglCanvasToTexture(gl, createRepeatingBrickPattern(rng, textureDimension, textureDimension, roofTilesAcross, roofTilesDown, 1 / (rng(roofTilesAcross) + 1), 0, colors.wallUpper, colors.wallUpper, brickRounding, groutWidth, colors.grout));
                if (tile.type == TILE_TYPE_ROOFLESS) {
                    childRenders['W'] = new ShapeRender([matrixTranslate4(0.5, 1.5, 0), matrixRotateZ4(-Math.PI / 2), matrixRotateY4(Math.PI / 2)], this.surfaceRenderParams, wallTexture2);
                    childRenders['E'] = new ShapeRender([matrixTranslate4(-0.5, 1.5, 0), matrixRotateZ4(Math.PI / 2), matrixRotateY4(-Math.PI / 2)], this.surfaceRenderParams, wallTexture2);
                    childRenders['N'] = new ShapeRender([matrixTranslate4(0, 1.5, 0.5), matrixRotateX4(Math.PI / 2)], this.surfaceRenderParams, wallTexture1);
                    childRenders['S'] = new ShapeRender([matrixTranslate4(0, 1.5, -0.5), matrixRotateX4(-Math.PI / 2), matrixRotateY4(Math.PI)], this.surfaceRenderParams, wallTexture1);
                } else {
                    childRenders['c'] = new ShapeRender([matrixTranslate4(0, 1, 0), matrixRotateX4(Math.PI)], this.surfaceRenderParams, ceilingTexture);
                }
                this.textures.push(wallTexture1, wallTexture2, ceilingTexture, floorTexture);
            }
            if (tile.entity) {
                // add the entity render
                let render = this.createEntityRender(tile.entity, x, y);
                this.entityRenders[tile.entity.id] = render;
                if (tile.entity.behaviorType == BEHAVIOR_TYPE_PLAYER) {
                    this.cameraEntityRender = render;
                }
            }

            for (let key in tile.dice) {
                let diceAndFace = tile.dice[key];
                let render = this.createRestingTileDiceRender(diceAndFace.dice, 0, 0, diceAndFace.face);
                childRenders[key] = render;
            }

            let transform = matrixTranslate4(x, 0, y);
            let tileRender = new CompositeRender([transform], childRenders);
            return tileRender;
        });
        this.draw(gl);
    }

    draw(gl: WebGLRenderingContext, usePickTextures?: boolean) {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // move to position
        //gl.uniformMatrix4fv(this.cameraPositionUniform, false, new Float32Array(this.cameraPositionMatrix));
        // set projection
        //gl.uniformMatrix4fv(this.cameraProjectionUniform, false, new Float32Array(this.cameraProjectionMatrix));
        //this.cameraPositionMatrix = matrixMultiply4(matrixTranslate4(0, 0, -0.5), matrixMultiply4(matrixRotateY4(viewAngleY), matrixTranslate4(viewX, -0.35, viewY)));
        if (this.cameraEntityRender) {
            let cameraPosition = matrixInvert4(this.cameraEntityRender.position);
            let cameraRotation = this.cameraEntityRender.rotation;
            let transformStack: Matrix4[] = [
                this.cameraProjectionMatrix,
                this.cameraEntityRender.facing,
                //matrixTranslate4(0, -0.5, -0.5),
                cameraRotation,
                cameraPosition
            ];

            for (let x = 0; x < this.level.width; x++) {
                for (let y = 0; y < this.level.height; y++) {
                    let tileRender = this.tileRenders[x][y];
                    tileRender.draw(gl, transformStack, usePickTextures);
                }
            }

            for (let entityId in this.entityRenders) {
                let entityRender = this.entityRenders[entityId];
                entityRender.draw(gl, transformStack, usePickTextures);
            }

        }
    }

    createEntityRender(entity: Entity, x: number, y: number): EntityRender {
        let rotation = matrixRotateY4(ORIENTATION_ANGLES[entity.orientation]);
        let position = matrixTranslate4(x, 0, y);

        return new EntityRender(entity, position, rotation, this.healthBuffer, nil, nil);
    }


    createRestingTileDiceRender(dice: Dice, x: number, y: number, face: DiceFace): Render {

        let rotation = matrixMultiply4(matrixRotateY4(pi * Math.random()), DICE_FACE_ROTATIONS[face]);
        let position = matrixTranslate4(x, this.halfDiceSize, y);
        let texture = webglCanvasToTexture(this.context, createDiceTexture(256, 128, this.diceTextureCoordinates, dice));
        this.textures.push(texture);

        let pickTexture = webglCanvasToTexture(this.context, createPickTexture(dice.diceId));

        return new ShapeRender([position, rotation], this.diceRenderParams, texture, pickTexture);

    }
}
