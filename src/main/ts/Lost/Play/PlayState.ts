///<reference path="../State.ts"/>

class PlayState extends State<HTMLCanvasElement> {

    tileRenders: Render[][];
    entityRenders: { [_: number]: EntityRender };
    cameraEntityRender: EntityRender;
    context: WebGLRenderingContext;

    //private cameraPositionMatrix: Matrix4;
    private cameraProjectionMatrix: Matrix4;
    private levelUpdater: LevelUpdater;
    private keyInputFactories: { [_: number]: () => Input };

    private updateAnimation: Animation;
    private animationFrameRequest: number;

    private floorRenderParams: ShapeRenderParams;

    private healthBuffer: WebGLBuffer;
//    private vertexPositionAttribute: number;
//    private transformUniform: WebGLUniformLocation;

    private textures: WebGLTexture[] = [];

    private queuedStateChangeData: LevelDeltaDataChangeState;

    constructor(private gameService: GameService, private game: Game, private level: Level, private viewerEntity: Entity, private queuedLevelDeltas: LevelDelta[]) {
        super('p');

        this.keyInputFactories = {};
        let simpleInputFactory = function (type: InputType) {
            return function () {
                return {
                    type: type
                }
            }
        };
        // up
        this.keyInputFactories[38] = simpleInputFactory(INPUT_TYPE_MOVE_FORWARD);
        // left
        this.keyInputFactories[37] = simpleInputFactory(INPUT_TYPE_TURN_LEFT);
        // right
        this.keyInputFactories[39] = simpleInputFactory(INPUT_TYPE_TURN_RIGHT);
        // down
        this.keyInputFactories[40] = simpleInputFactory(INPUT_TYPE_LOOK_DOWN);

        this.levelUpdater = new LevelUpdater(this.game, this.level);
    }

    init(stateListener: StateListener): void {
        super.init(stateListener);

        let width = this.element.clientWidth;
        let height = this.element.clientHeight;
        this.element.width = width;
        this.element.height = height;
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

        this.cameraProjectionMatrix = matrixPerspective4(pi/3, width / height, 0.1, 100.0);
        //this.transformUniform = gl.getUniformLocation(shaderProgram, "uTransform");

        let floorVertices = [
            0.5, 0, 0.5,
            -0.5, 0, 0.5,
            0.5, 0, -0.5,
            -0.5, 0, -0.5
        ];
        let floorIndices = [
            0, 2, 1,
            2, 3, 1
        ];
        let floorTextureCoordinates = [
            1, 1,
            0, 1,
            1, 0,
            0, 0
        ];
        this.floorRenderParams = ShapeRender.init(
            gl,
            shaderProgram,
            floorVertices,
            floorIndices,
            floorTextureCoordinates
        );

        /*
        this.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
        gl.enableVertexAttribArray(this.vertexPositionAttribute); 
            
        this.floorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.floorBuffer);
        */
        /*
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(floorVertices), gl.STATIC_DRAW);

        this.floorIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.floorIndexBuffer);
        */
        /*
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(floorIndices), gl.STATIC_DRAW);
        */
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

    createEntityRender(entity: Entity, x: number, y: number): EntityRender {
        let rotation = matrixRotateY4(ORIENTATION_ANGLES[entity.orientation]);
        let position = matrixTranslate4(x, 0, y);

        return new EntityRender(entity, position, rotation, this.healthBuffer, null, null);
    }

    start() {
        window.onkeydown = (e: KeyboardEvent) => {
            let inputFactory = this.keyInputFactories[e.keyCode];
            if (inputFactory) {
                let updateNow = this.levelUpdater.queueInput(inputFactory());
                if (updateNow) {
                    this.update(performance.now());
                }
            }
        };
        this.draw(this.context);
        // kick off the action
        let t = performance.now();
        this.update(t);

        let animate = (t: number) => {
            this.animate(t);
            this.animationFrameRequest = requestAnimationFrame(animate);
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

    redraw() {
        let gl = this.context;
        let rng = trigRandomNumberGeneratorFactory(this.game.randomNumberSeed + this.level.levelId * 999);

        let groutWidth = rng(3)+1;
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
        

        this.updateAnimation = null;
        this.entityRenders = {};
        this.tileRenders = create2DArray(this.level.width, this.level.height, (x: number, y: number) => {
            let tile = this.level.tiles[x][y];
            let childRenders: { [_: string]: Render } = {};

            if (tile.type != TILE_TYPE_SOLID) {
                let wallTexture1 = webglCanvasToTexture(gl, createRepeatingBrickPattern(rng, textureDimension, textureDimension, bricksAcross, bricksDown, 0.5, 0, colors.wallUpper, colors.wallLower, brickRounding, groutWidth, colors.grout, tile.type == TILE_TYPE_ROOFLESS || tile.type == TILE_TYPE_PIT ? ' ✋ ' : ' '));
                let wallTexture2 = webglCanvasToTexture(gl, createRepeatingBrickPattern(rng, textureDimension, textureDimension, bricksAcross, bricksDown, 0.5, 0.5, colors.wallUpper, colors.wallLower, brickRounding, groutWidth, colors.grout, tile.type == TILE_TYPE_ROOFLESS || tile.type == TILE_TYPE_PIT ? ' ✋ ' : ' '));
                if (x == 0 || this.level.tiles[x - 1][y].type == TILE_TYPE_SOLID ) {
                    // add a wall to the west
                    childRenders['w'] = new ShapeRender([matrixTranslate4(-0.5, 0.5, 0), matrixRotateZ4(Math.PI / 2),matrixRotateY4(Math.PI / 2)], this.floorRenderParams, wallTexture1);
                }
                if (x == this.level.width-1 || this.level.tiles[x + 1][y].type == TILE_TYPE_SOLID) {
                    // add a wall to the west
                    childRenders['e'] = new ShapeRender([matrixTranslate4(0.5, 0.5, 0), matrixRotateZ4(-Math.PI / 2), matrixRotateY4(-Math.PI / 2)], this.floorRenderParams, wallTexture1);
                }
                if (y == 0 || this.level.tiles[x][y - 1].type == TILE_TYPE_SOLID) {
                    // add a wall to the west
                    childRenders['n'] = new ShapeRender([matrixTranslate4(0, 0.5, -0.5), matrixRotateX4(-Math.PI / 2)], this.floorRenderParams, wallTexture2);
                }
                if (y == this.level.height-1 || this.level.tiles[x][y + 1].type == TILE_TYPE_SOLID) {
                    // add a wall to the west
                    childRenders['s'] = new ShapeRender([matrixTranslate4(0, 0.5, 0.5), matrixRotateX4(Math.PI / 2), matrixRotateY4(Math.PI)], this.floorRenderParams, wallTexture2);
                }
                // add a floor
                let floorTexture = webglCanvasToTexture(gl, createRepeatingBrickPattern(rng, textureDimension, textureDimension, 1, 1, 0, 0, colors.floor, colors.floor, brickRounding * 4, groutWidth * 3, colors.grout, tile.type == TILE_TYPE_ROOFLESS ?'✖':' '));
                if (tile.type == TILE_TYPE_PIT) {
                    childRenders['W'] = new ShapeRender([matrixTranslate4(0.5, -0.5, 0), matrixRotateZ4(-Math.PI / 2), matrixRotateY4(Math.PI / 2)], this.floorRenderParams, wallTexture2);
                    childRenders['E'] = new ShapeRender([matrixTranslate4(-0.5, -0.5, 0), matrixRotateZ4(Math.PI / 2), matrixRotateY4(-Math.PI / 2)], this.floorRenderParams, wallTexture2);
                    childRenders['N'] = new ShapeRender([matrixTranslate4(0, -0.5, 0.5), matrixRotateX4(Math.PI / 2)], this.floorRenderParams, wallTexture1);
                    childRenders['S'] = new ShapeRender([matrixTranslate4(0, -0.5, -0.5), matrixRotateX4(-Math.PI / 2), matrixRotateY4(Math.PI)], this.floorRenderParams, wallTexture1);
                } else {
                    childRenders['f'] = new ShapeRender([matrixRotateY4(pi/2 * rng(4))], this.floorRenderParams, floorTexture);
                }
                let ceilingTexture = webglCanvasToTexture(gl, createRepeatingBrickPattern(rng, textureDimension, textureDimension, roofTilesAcross, roofTilesDown, 1 / (rng(roofTilesAcross) + 1), 0, colors.wallUpper, colors.wallUpper, brickRounding, groutWidth, colors.grout));
                if (tile.type == TILE_TYPE_ROOFLESS) {
                    childRenders['W'] = new ShapeRender([matrixTranslate4(0.5, 1.5, 0), matrixRotateZ4(-Math.PI / 2), matrixRotateY4(Math.PI / 2)], this.floorRenderParams, wallTexture2);
                    childRenders['E'] = new ShapeRender([matrixTranslate4(-0.5, 1.5, 0), matrixRotateZ4(Math.PI / 2), matrixRotateY4(-Math.PI / 2)], this.floorRenderParams, wallTexture2);
                    childRenders['N'] = new ShapeRender([matrixTranslate4(0, 1.5, 0.5), matrixRotateX4(Math.PI / 2)], this.floorRenderParams, wallTexture1);
                    childRenders['S'] = new ShapeRender([matrixTranslate4(0, 1.5, -0.5), matrixRotateX4(-Math.PI / 2), matrixRotateY4(Math.PI)], this.floorRenderParams, wallTexture1);
                } else {
                    childRenders['c'] = new ShapeRender([matrixTranslate4(0, 1, 0), matrixRotateX4(Math.PI)], this.floorRenderParams, ceilingTexture);
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

            let transform = matrixTranslate4(x, 0, y);
            let tileRender = new CompositeRender([transform], childRenders);
            return tileRender;
        });
        this.draw(gl);
    }

    draw(gl: WebGLRenderingContext) {
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
                    tileRender.draw(gl, transformStack);
                }
            }

            for (let entityId in this.entityRenders) {
                let entityRender = this.entityRenders[entityId];
                entityRender.draw(gl, transformStack);
            }

        }
    }


}
