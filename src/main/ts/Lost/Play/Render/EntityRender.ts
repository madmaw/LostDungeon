class EntityRender extends Render {
    public facing: Matrix4;

    constructor(
        private state: PlayState,
        public entity: Entity,
        public position: Matrix4,
        public rotation: Matrix4,
        public healthRenders: Render[],
        public diceRenders: { [_: number]: Render }
    ) {
        super([position, rotation]);
        this.facing = this.look(-pi/9, .8, .5);
    }

    look(radians: number, height: number, stepBack): Matrix4 {
        return matrixMultiply4(matrixRotateX4(radians), matrixTranslate4(0, -height, -stepBack))
    }

    consume(t: number, delta: LevelDelta): Animation {
        let animation: Animation;
        // anything entity related will have the value of 'entity' in the data
        if (delta.data && (<any>delta.data).entity == this.entity) {
            switch (delta.type) {
                case LEVEL_DELTA_TYPE_MOVE:
                    let moveData = <LevelDeltaDataMove>delta.data;
                    let dpos = ORIENTATION_DIFFS[moveData.direction];
                    let targetPosition = matrixTranslate4(moveData.fromX + dpos.x, 0, moveData.fromY + dpos.y);
                    animation = animationTweenFactory(
                        t,
                        easingQuadraticFactory(.004),
                        [
                            effectCopyMatrixIntoFactory(this.position, valueFactoryMatrix4InterpolationFactory(matrixCopy4(this.position), targetPosition))
                        ]
                    );
                    break;
                case LEVEL_DELTA_TYPE_TURN:
                    let turnData = <LevelDeltaDataTurn>delta.data;
                    let fromAngle = ORIENTATION_ANGLES[turnData.fromOrientation];
                    let toAngle = ORIENTATION_ANGLES[turnData.toOrientation];
                    toAngle = normalizeAngle(toAngle, fromAngle);
                    // ensure we're turning the minimum distance
                    animation = animationTweenFactory(
                        t,
                        easingQuadraticFactory(.004),
                        [
                            effectCopyMatrixIntoFactory(this.rotation, valueFactoryMatrix4RotationFactory(0, 1, 0, fromAngle, toAngle))
                        ]
                    );
                    break;
                case LEVEL_DELTA_TYPE_LOOK_DOWN:
                    animation = animationTweenFactory(
                        t,
                        easingQuadraticFactory(.004),
                        [
                            effectCopyMatrixIntoFactory(
                                this.facing,
                                valueFactoryMatrix4InterpolationFactory(matrixCopy4(this.facing), this.look(-pi / 3, 1, .3))
                            )
                        ]
                    );
                    break;
                case LEVEL_DELTA_TYPE_LOOK_UP:
                    animation = animationTweenFactory(
                        t,
                        easingQuadraticFactory(.004),
                        [
                            effectCopyMatrixIntoFactory(this.facing, valueFactoryMatrix4InterpolationFactory(matrixCopy4(this.facing), this.look(-pi / 9, .8, .5)))
                        ]

                    );
                    break;
                case LEVEL_DELTA_TYPE_FALL:
                    let fallData = <LevelDeltaDataFall>delta.data;
                    animation = animationChainedProxyFactory(
                        animationTweenFactory(
                            t,
                            easingQuadraticFactory(.002),
                            [
                                effectCopyMatrixIntoFactory(this.facing, valueFactoryMatrix4InterpolationFactory(matrixCopy4(this.facing), this.look(-piOn2, 0, 0)))
                            ]
                        ),
                        (t: number) => {
                            return animationTweenFactory(
                                t,
                                easingQuadraticFactory(.009),
                                [
                                    effectCopyMatrixIntoFactory(this.facing, valueFactoryMatrix4InterpolationFactory(matrixCopy4(this.facing), this.look(-piOn2, -1, 0)))
                                ]
                            );
                        }
                    );
                    break;
                case LEVEL_DELTA_TYPE_DROP_IN:
                    animation = animationTweenFactory(
                        t,
                        easingQuadraticFactory(.001),
                        [
                            effectCopyMatrixIntoFactory(this.facing, valueFactoryMatrix4InterpolationFactory(this.look(-pi / 2, 1.5, 0), this.look(-pi / 9, .8, .5)))
                        ]
                    );
                    break;
                case LEVEL_DELTA_TYPE_COLLECT_DICE:
                    {
                        // look up the tile and remove the dice renderer
                        let collectDiceData = <LevelDeltaDataCollectDice>delta.data;
                        let tileRender = <CompositeRender>this.state.tileRenders[collectDiceData.fromTileX][collectDiceData.fromTileY];
                        let diceRender = tileRender.children[collectDiceData.fromTilePosition];
                        delete tileRender.children[collectDiceData.fromTilePosition];
                        // add and animate dice render to this render
                        let previousTransforms = tileRender.localTransforms.slice();
                        previousTransforms.push.apply(previousTransforms, diceRender.localTransforms);
                        let previousTransform = matrixMultiplyStack4(previousTransforms);
                        let oldPosition = vectorTransform3Matrix4(0, 0, 0, previousTransform);


                        let newTransforms = this.localTransforms;
                        let newTransform = matrixMultiplyStack4(newTransforms);
                        let newPosition = vectorTransform3Matrix4(0, 0, 0, newTransform);

                        //console.log('old position ' + oldPosition[0] + ", " + oldPosition[1] + "," + oldPosition[2]);
                        //console.log('new position ' + newPosition[0] + ", " + newPosition[1] + "," + newPosition[2]);

                        let offsetTranslate = matrixTranslate4(oldPosition[0] - newPosition[0], oldPosition[1] - newPosition[1], oldPosition[2] - newPosition[2]);
                        let yAngle = TILE_SLOTS_ALL[collectDiceData.fromTilePosition].rotation;
                        let yRotation = matrixRotateY4(yAngle);
                        let offsetRotate = matrixInvert4(this.rotation);
                        let diceFaceRotation = DICE_FACE_ROTATIONS[collectDiceData.fromFace];
                        let offsetDiceRotation = matrixCopy4(diceFaceRotation.matrix);
                        diceRender.localTransforms = [offsetRotate, offsetTranslate, yRotation, offsetDiceRotation];
                        diceRender.animating = <any>1;

                        this.diceRenders[collectDiceData.dice.diceId] = diceRender;

                        //let targetTransform = matrixTranslate4(collectDiceData.entity.dice.length / 10 - .5, .8, .2);
                        let targetTransform = matrixTranslate4(0, 1, 0);

                        animation = animationTweenFactory(
                            t,
                            easingQuadraticFactory(.003),
                            [
                                effectCopyMatrixIntoFactory(offsetTranslate, valueFactoryMatrix4InterpolationFactory(matrixCopy4(offsetTranslate), targetTransform)),
                                effectCopyMatrixIntoFactory(offsetDiceRotation, valueFactoryMatrix4RotationFactory(diceFaceRotation.axisX, diceFaceRotation.axisY, diceFaceRotation.axisZ, diceFaceRotation.radians + pi2, 0)),
                                effectCopyMatrixIntoFactory(yRotation, valueFactoryMatrix4RotationFactory(0, 1, 0, yAngle, 0))
                            ]
                        );

                        animation = animationChainedProxyFactory(
                            animation,
                            () => {
                                // don't actualy produce an animation, just tidy up our inventory
                                if (this.entity.behaviorType == BEHAVIOR_TYPE_PLAYER) {
                                    this.state.redrawInventory();
                                }
                                diceRender.animating = false;
                            }
                        )
                    }
                    break;
                case LEVEL_DELTA_TYPE_PLAY_DICE:
                    {
                        this.state.redrawInventory();
                        let playDiceData = <LevelDeltaDataPlayDice>delta.data;
                        let playedDiceRender = this.diceRenders[playDiceData.dice.diceId];
                        delete this.diceRenders[playDiceData.dice.diceId];
                        let toTileRender = <CompositeRender>this.state.tileRenders[playDiceData.toTileX][playDiceData.toTileY];
                        toTileRender.children[playDiceData.toTilePosition] = playedDiceRender;
                        // position the dice render
                        let tileSlot: TileSlot = TILE_SLOTS_ALL[playDiceData.toTilePosition];
                        let toFaceRotation = DICE_FACE_ROTATIONS[playDiceData.toFace];

                        let oldTransforms = this.localTransforms;
                        let oldTransform = matrixMultiplyStack4(oldTransforms);
                        let oldPosition = vectorTransform3Matrix4(0, 0, 0, oldTransform);

                        let sourceTranslate = matrixTranslate4(oldPosition[0] - playDiceData.toTileX, 0, oldPosition[2] - playDiceData.toTileY);
                        let targetTranslate = matrixTranslate4(tileSlot.dx, this.state.halfDiceSize, tileSlot.dy);

                        let sourceDropHeight = matrixTranslate4(0, 1, 0);
                        let targetDropHeight = matrixIdentity4();

                        let sourceDiceFaceRotation = matrixIdentity4();
                        let targetDiceFaceRotation = DICE_FACE_ROTATIONS[playDiceData.toFace];

                        let yRotation = matrixIdentity4();
                        let yAngle = TILE_SLOTS_ALL[playDiceData.toTilePosition].rotation;

                        playedDiceRender.localTransforms = [
                            sourceTranslate,
                            sourceDropHeight,
                            yRotation,
                            sourceDiceFaceRotation
                        ];


                        animation = animationCompositeFactory([
                                animationTweenFactory(
                                    t,
                                    easingLinearFactory(.002),
                                    [
                                        effectCopyMatrixIntoFactory(sourceTranslate, valueFactoryMatrix4InterpolationFactory(matrixCopy4(sourceTranslate), targetTranslate)),
                                        effectCopyMatrixIntoFactory(sourceDiceFaceRotation, valueFactoryMatrix4RotationFactory(targetDiceFaceRotation.axisX, targetDiceFaceRotation.axisY, targetDiceFaceRotation.axisZ, 0, targetDiceFaceRotation.radians + pi2)),
                                        effectCopyMatrixIntoFactory(yRotation, valueFactoryMatrix4RotationFactory(0, 1, 0, 0, yAngle))
                                    ]
                                ),
                                animationTweenFactory(
                                    t,
                                    easingQuadraticFactory(.003),
                                    [
                                        effectCopyMatrixIntoFactory(sourceDropHeight, valueFactoryMatrix4InterpolationFactory(matrixCopy4(sourceDropHeight), targetDropHeight))
                                    ]
                                )
                        ])
                    }
                    break;
            }

        }
        return animation;
    }

    doDraw(gl: WebGLRenderingContext, transformStack: Matrix4[], pickTexture: boolean): void {
        // don't actually draw the player
        let renderAll = this.entity.behaviorType != BEHAVIOR_TYPE_PLAYER;
        if (renderAll) {
            let transform = matrixMultiplyStack4(transformStack);

        }
        for (let diceId in this.diceRenders) {
            let diceRender = this.diceRenders[diceId];
            if( diceRender.animating || renderAll)
            diceRender.draw(gl, transformStack, pickTexture);
        }

    }
}
