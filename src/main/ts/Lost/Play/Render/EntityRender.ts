interface RenderAndIndex {
    render: Render;
    index: number;
}

interface EntityRenderSoundEffects {
    hurt: SoundEffect;
    diceLand: SoundEffect;
    diceThrow: SoundEffect;
    diceCollect: SoundEffect;
    stepFailed: SoundEffect;
    powerup: SoundEffect;
    fall: SoundEffect;
}


interface EntityRender extends Render {
    entity: Entity;
    bodyPosition: Matrix4;
    bodyRotation: Matrix4;
    headRotation: Matrix4;
    healthRenders: Render[],
    diceRenders: { [_: number]: RenderAndIndex },
    effectiveResourceCounts: { [_: number]: number },
    effectiveHealth: number
}

function entityRenderFactory(
    entity: Entity,
    position: Matrix4,
    rotation: Matrix4,
    healthRenders: Render[],
    diceRenders: { [_: number]: RenderAndIndex },
    tileRenders: Render[][],
    redrawInventory: () => void,
    halfDiceSize: number,
    effectiveResourceCounts: { [_: number]: number },
    effectiveHealth: number,
    soundEffects: EntityRenderSoundEffects
): EntityRender {

    function look(radians: number, height: number, stepBack): Matrix4 {
        return matrixMultiply4(matrixRotateX4(radians), matrixTranslate4(0, -height, -stepBack))
    }

    function shortenAngle(a: number) {
        a = a % pi2;
        if (a > pi) {
            a -= pi2;
        }
        return a;
    }

    function getDiceTransformationStack(diceIndex: number, r: number, multiplier: number, translationMultiplier?: number) {
        if (translationMultiplier == nil) {
            translationMultiplier = multiplier
        }
        let a = shortenAngle(r + (pi2 * diceIndex) / entity.diceSlots);
        let r2 = shortenAngle(r * 2);
        return [
            matrixRotateZ4(a * multiplier),
            matrixTranslate4(0, (.5 - halfDiceSize * 1.4) * translationMultiplier, 0),
            matrixRotateZ4((-r2 + pi / 4) * multiplier),
            matrixRotateX4(pi * multiplier / 4),
            matrixRotateY4(pi * multiplier / 4)
        ];
    }

    let r = 0;

    let entityRender = {
        update: function (t: number) {
            // update the health and dice renders
            r = t * .0005;
        },
        consume: function (t: number, delta: LevelDelta): Animation {
            let animation: Animation;
            // anything entity related will have the value of 'entity' in the data
            if (delta.deltaData && (<any>delta.deltaData).entity == entity) {
                switch (delta.deltaType) {
                    case LEVEL_DELTA_TYPE_MOVE_INVALID:
                        soundEffects.stepFailed(random(), entityRender.localTransforms);
                        break;
                    case LEVEL_DELTA_TYPE_MOVE:
                        {
                            let moveData = <LevelDeltaDataMove>delta.deltaData;
                            let dpos = ORIENTATION_DIFFS[moveData.moveDirection];
                            let targetPosition = matrixTranslate4(moveData.fromX + dpos.x, .5, moveData.fromY + dpos.y);
                            let duration = 250;
                            animation = animationTweenFactory(
                                t,
                                duration,
                                easingQuadraticInFactory(duration),
                                [
                                    effectCopyMatrixIntoFactory(position, valueFactoryMatrix4InterpolationFactory(matrixCopy4(position), targetPosition))
                                ]
                            );
                        }
                        break;
                    case LEVEL_DELTA_TYPE_TURN:
                        {
                            let turnData = <LevelDeltaDataTurn>delta.deltaData;
                            let fromAngle = ORIENTATION_ANGLES[turnData.fromOrientation];
                            let toAngle = ORIENTATION_ANGLES[turnData.toOrientation];
                            toAngle = normalizeAngle(toAngle, fromAngle);
                            // ensure we're turning the minimum distance
                            let duration = 250;
                            animation = animationTweenFactory(
                                t,
                                duration,
                                easingQuadraticInFactory(duration),
                                [
                                    effectCopyMatrixIntoFactory(rotation, valueFactoryMatrix4RotationFactory(0, 1, 0, fromAngle, toAngle))
                                ]
                            );
                        }
                        break;
                    case LEVEL_DELTA_TYPE_LOOK_DOWN:
                        {
                            let duration = 250;
                            animation = animationTweenFactory(
                                t,
                                duration,
                                easingQuadraticInFactory(duration),
                                [
                                    effectCopyMatrixIntoFactory(
                                        entityRender.headRotation,
                                        valueFactoryMatrix4InterpolationFactory(matrixCopy4(entityRender.headRotation), look(-pi / 3, .5, .3))
                                    )
                                ]
                            );
                        }
                        break;
                    case LEVEL_DELTA_TYPE_LOOK_UP:
                        {
                            let duration = 250;
                            animation = animationTweenFactory(
                                t,
                                duration,
                                easingQuadraticInFactory(duration),
                                [
                                    effectCopyMatrixIntoFactory(entityRender.headRotation, valueFactoryMatrix4InterpolationFactory(matrixCopy4(entityRender.headRotation), look(-pi / 9, .3, .5)))
                                ]

                            );
                        }
                        break;
                    case LEVEL_DELTA_TYPE_FALL:
                        {
                            let duration1 = 600;
                            let duration2 = 600;
                            let fallData = <LevelDeltaDataFall>delta.deltaData;
                            soundEffects.fall(1, entityRender.localTransforms);
                            animation = animationChainedProxyFactory(
                                animationTweenFactory(
                                    t,
                                    duration1,
                                    easingQuadraticInFactory(duration1),
                                    [
                                        effectCopyMatrixIntoFactory(entityRender.headRotation, valueFactoryMatrix4InterpolationFactory(matrixCopy4(entityRender.headRotation), look(-piOn2, -.5, 0)))
                                    ]
                                ),
                                function (t: number) {
                                    return animationTweenFactory(
                                        t,
                                        duration2,
                                        easingQuadraticOutFactory(duration2),
                                        [
                                            effectCopyMatrixIntoFactory(entityRender.headRotation, valueFactoryMatrix4InterpolationFactory(matrixCopy4(entityRender.headRotation), look(-piOn2, -1, 0)))
                                        ]
                                    );
                                }
                            );

                        }
                        break;
                    case LEVEL_DELTA_TYPE_DROP_IN:
                        {
                            let duration = 999;
                            animation = animationChainedProxyFactory(
                                animationTweenFactory(
                                    t,
                                    duration,
                                    easingLinearFactory(duration),
                                    [
                                        effectCopyMatrixIntoFactory(entityRender.headRotation, valueFactoryMatrix4InterpolationFactory(look(-pi / 2, 1.5, 0), look(-pi / 9, .3, .5)))
                                    ]
                                ),
                                function () {
                                    soundEffects.stepFailed(.5, entityRender.localTransforms);
                                }
                            );
                        }
                        break;
                    case LEVEL_DELTA_TYPE_COLLECT_DICE:
                        {
                            // look up the tile and remove the dice renderer
                            let collectDiceData = <LevelDeltaDataCollectDice>delta.deltaData;
                            let tileRender = <CompositeRender>tileRenders[collectDiceData.fromTileX][collectDiceData.fromTileY];
                            let diceRender = tileRender.childRenders[collectDiceData.fromTilePosition];
                            delete tileRender.childRenders[collectDiceData.fromTilePosition];
                            // add and animate dice render to this render
                            let previousTransforms = copyArray(tileRender.localTransforms);
                            arrayPushAll(previousTransforms, diceRender.localTransforms);
                            let previousTransform = matrixMultiplyStack4(previousTransforms);
                            let oldPosition = vectorTransform3Matrix4(0, 0, 0, previousTransform);

                            let newTransforms = copyArray(entityRender.localTransforms);
                            // work out the animation position for this die slot
                            let newTransform = matrixMultiplyStack4(newTransforms);
                            let newPosition = vectorTransform3Matrix4(0, 0, 0, newTransform);

                            //console.log('old position ' + oldPosition[0] + ", " + oldPosition[1] + "," + oldPosition[2]);
                            //console.log('new position ' + newPosition[0] + ", " + newPosition[1] + "," + newPosition[2]);

                            let offsetTranslate = matrixTranslate4(oldPosition[0] - newPosition[0], halfDiceSize - newPosition[1], oldPosition[2] - newPosition[2]);
                            let tileSlot: TileSlot = TILE_SLOTS_ALL[collectDiceData.fromTilePosition];
                            let yAngle = tileSlot.slotRotation;
                            let rnow = r;
                            let offsetSpin = matrixMultiplyStack4(getDiceTransformationStack(collectDiceData.toDiceSlot, rnow, -1).reverse());
                            let yRotation = matrixRotateY4(yAngle);
                            let offsetRotate = matrixInvert4(rotation);
                            let rotateToAngle = ORIENTATION_ANGLES[entity.entityOrientation];
                            let rotateTo = matrixIdentity4();
                            let diceFaceRotation = DICE_FACE_ROTATIONS[collectDiceData.fromFace];
                            let offsetDiceRotation = matrixCopy4(diceFaceRotation.matrix);
                            diceRender.localTransforms = [offsetSpin, offsetRotate, offsetTranslate, rotateTo, yRotation, offsetDiceRotation];
                            diceRender.animating = <any>1;

                            diceRenders[collectDiceData.dice.diceId] = {
                                render: diceRender,
                                index: collectDiceData.toDiceSlot
                            };

                            let targetTransform = matrixTranslate4(0, 0, 0);

                            soundEffects.diceCollect(1, entityRender.localTransforms);

                            let duration = 999;
                            animation = animationCompositeFactory([
                                animationTweenFactory(
                                    t,
                                    duration,
                                    easingLinearFactory(duration),
                                    [
                                        effectCopyMatrixIntoFactory(offsetDiceRotation, valueFactoryMatrix4RotationFactory(diceFaceRotation.axisX, diceFaceRotation.axisY, diceFaceRotation.axisZ, diceFaceRotation.radians, 0)),
                                        effectCopyMatrixIntoFactory(rotateTo, valueFactoryMatrix4RotationFactory(0, 1, 0, 0, rotateToAngle)),
                                        effectCopyMatrixIntoFactory(yRotation, valueFactoryMatrix4RotationFactory(0, 1, 0, yAngle, 0)),
                                        effectCopyMatrixIntoFactory(offsetSpin, function (p: number, matrix: Matrix4) {
                                            let value = matrixMultiplyStack4(getDiceTransformationStack(collectDiceData.toDiceSlot, rnow, p - 1).reverse());
                                            matrixCopyInto4(value, matrix);
                                            return matrix;
                                        })
                                    ]
                                ),
                                animationTweenFactory(
                                    t,
                                    duration,
                                    easingQuadraticInFactory(duration),
                                    [
                                        effectCopyMatrixIntoFactory(offsetTranslate, valueFactoryMatrix4InterpolationFactory(matrixCopy4(offsetTranslate), targetTransform))
                                    ]
                                )
                            ]);

                            animation = animationChainedProxyFactory(
                                animation,
                                function() {
                                    // don't actualy produce an animation, just tidy up our inventory
                                    if (entity.behaviorType == BEHAVIOR_TYPE_PLAYER) {
                                        redrawInventory();
                                    }
                                    diceRender.animating = <any>0;
                                }
                            )
                        }
                        break;
                    case LEVEL_DELTA_TYPE_PLAY_DICE:
                        {

                            if (entity.behaviorType == BEHAVIOR_TYPE_PLAYER) {
                                redrawInventory();
                            }
                            let playDiceData = <LevelDeltaDataPlayDice>delta.deltaData;
                            let playedDiceRender = diceRenders[playDiceData.dice.diceId].render;
                            delete diceRenders[playDiceData.dice.diceId];
                            let toTileRender = <CompositeRender>tileRenders[playDiceData.toTileX][playDiceData.toTileY];
                            toTileRender.childRenders[playDiceData.toTilePosition] = playedDiceRender;
                            // position the dice render
                            let tileSlot: TileSlot = TILE_SLOTS_ALL[playDiceData.toTilePosition];
                            let toFaceRotation = DICE_FACE_ROTATIONS[playDiceData.toFace];

                            let rnow = r;

                            let oldTransforms = matrixCopy4(entityRender.localTransforms);
                            arrayPushAll(oldTransforms, getDiceTransformationStack(playDiceData.fromDiceSlot, rnow, 1));
                            let oldTransform = matrixMultiplyStack4(oldTransforms);
                            let oldPosition = vectorTransform3Matrix4(0, 0, 0, oldTransform);

                            let sourceTranslate = matrixTranslate4(oldPosition[0] - playDiceData.toTileX, oldPosition[1], oldPosition[2] - playDiceData.toTileY);
                            let targetTranslate = matrixTranslate4(tileSlot.dx, halfDiceSize, tileSlot.dy);

                            // use this to have a throwing motion
                            let sourceDropHeight = matrixIdentity4();
                            let targetDropHeight = matrixTranslate4(0, (entity.lookingDown?.2:.4) + random()/7, 0);

                            let offsetSpin = matrixMultiplyStack4(getDiceTransformationStack(playDiceData.fromDiceSlot, 1, 0));

                            let sourceDiceFaceRotation = matrixIdentity4();
                            let targetDiceFaceRotation = DICE_FACE_ROTATIONS[playDiceData.toFace];


                            let rotationY = matrixCopy4(rotation);
                            let rotationYFrom = ORIENTATION_ANGLES[entity.entityOrientation];
                            let rotationYTo = tileSlot.slotRotation;

                            playedDiceRender.localTransforms = [
                                sourceTranslate,
                                sourceDropHeight,
                                rotationY,
                                offsetSpin,
                                sourceDiceFaceRotation
                            ];


                            soundEffects.diceThrow(random(), entityRender.localTransforms);
                            let duration1 = 800;
                            let duration2 = 600;
                            animation = animationCompositeFactory([
                                animationTweenFactory(
                                    t,
                                    duration1,
                                    easingQuadraticOutFactory(duration1),
                                    [
                                        effectCopyMatrixIntoFactory(sourceTranslate, valueFactoryMatrix4InterpolationFactory(matrixCopy4(sourceTranslate), targetTranslate)),
                                        effectCopyMatrixIntoFactory(sourceDiceFaceRotation, valueFactoryMatrix4RotationFactory(targetDiceFaceRotation.axisX, targetDiceFaceRotation.axisY, targetDiceFaceRotation.axisZ, 0, targetDiceFaceRotation.radians + pi2)),
                                        effectCopyMatrixIntoFactory(rotationY, valueFactoryMatrix4RotationFactory(0, 1, 0, rotationYFrom, rotationYTo)),
                                        effectCopyMatrixIntoFactory(offsetSpin, function (p: number, into: Matrix4) {
                                            let t = matrixMultiplyStack4(getDiceTransformationStack(playDiceData.fromDiceSlot, rnow, 1 - p, 0));
                                            matrixCopyInto4(t, into);
                                            return into;
                                        })
                                    ]
                                ),
                                animationChainedProxyFactory(
                                    animationTweenFactory(
                                        t,
                                        duration2,
                                        easingQuadraticOutFactory(duration2 / 2),
                                        [
                                            effectCopyMatrixIntoFactory(sourceDropHeight, valueFactoryMatrix4InterpolationFactory(matrixCopy4(sourceDropHeight), targetDropHeight))
                                        ]
                                    ),
                                    function () {
                                        soundEffects.diceLand(random(), toTileRender.localTransforms);
                                    }
                                )
                            ]);

                        }
                        break;
                    case LEVEL_DELTA_TYPE_RESOURCE_CHANGE:
                        let levelDeltaDataResourceChange = <LevelDeltaDataResourceChange>delta.deltaData;
                        entityRender.effectiveResourceCounts = levelDeltaDataResourceChange.newEffectiveResourceCounts;
                        // note falls through
                    case LEVEL_DELTA_TYPE_DICE_SLOTS_CHANGE:
                        if (levelDeltaDataResourceChange.entity.behaviorType == BEHAVIOR_TYPE_PLAYER) {
                            redrawInventory();
                        }
                        break;
                    case LEVEL_DELTA_TYPE_HEALTH_CHANGE:
                        {
                            let levelDeltaDataHealthChange = <LevelDeltaDataHealthChange>delta.deltaData;
                            entityRender.effectiveHealth = levelDeltaDataHealthChange.totalHealth;
                            if (levelDeltaDataHealthChange.deltaHealth < 0) {
                                soundEffects.hurt(-levelDeltaDataHealthChange.deltaHealth/2, entityRender.localTransforms);
                            }
                            if (levelDeltaDataHealthChange.entity.behaviorType == BEHAVIOR_TYPE_PLAYER) {
                                if (levelDeltaDataHealthChange.deltaHealth < 0) {
                                    // animate in some screen shake
                                    let duration = 300;
                                    animation = animationTweenFactory(
                                        t,
                                        duration,
                                        function (t: number) {
                                            let m = 1 - easingQuadraticOutFactory(duration)(t);
                                            return random() * m;
                                        },
                                        [
                                            effectCopyMatrixIntoFactory(entityRender.headRotation, valueFactoryMatrix4InterpolationFactory(matrixCopy4(entityRender.headRotation), matrixRotate4(random(), random(), random(), pi/6)))
                                        ]
                                    )
                                }
                                redrawInventory();
                            } else {
                                // animate in/out the health
                                let animations: Animation[] = [];
                                countForEach(abs(levelDeltaDataHealthChange.deltaHealth), function (i: number) {
                                    let effects: Effect[];
                                    let transforms: Matrix4[];
                                    let slot: number;
                                    if (levelDeltaDataHealthChange.deltaHealth > 0) {
                                        // animate it back in
                                        slot = levelDeltaDataHealthChange.totalHealth - i - 1;
                                        let rotation = matrixRotateZ4(pi);
                                        let scale = matrixScale4(0, 0, 0);
                                        transforms = [rotation, scale];
                                        effects = [
                                            effectCopyMatrixIntoFactory(rotation, valueFactoryMatrix4RotationFactory(0, 0, 1, pi2, 0)),
                                            effectCopyMatrixIntoFactory(scale, valueFactoryMatrix4InterpolationFactory(matrixCopy4(scale), matrixIdentity4()))
                                        ];
                                    } else {
                                        // animate it out
                                        slot = levelDeltaDataHealthChange.totalHealth + i;
                                        let rotation = matrixIdentity4();
                                        let scale = matrixIdentity4();
                                        transforms = [rotation, scale];
                                        effects = [
                                            effectCopyMatrixIntoFactory(rotation, valueFactoryMatrix4RotationFactory(1, 0, 0, 0, pi2)),
                                            effectCopyMatrixIntoFactory(scale, valueFactoryMatrix4InterpolationFactory(matrixCopy4(scale), matrixScale4(0, 0, 0)))
                                        ];
                                    }
                                    let healthRender = healthRenders[slot];
                                    healthRender.localTransforms = transforms;
                                    let duration = 999;
                                    let animation = animationTweenFactory(
                                        t,
                                        duration,
                                        easingQuadraticInFactory(duration),
                                        effects
                                    );
                                    animations.push(animation);
                                });
                                animation = animationCompositeFactory(animations);
                            }
                        }
                        break;
                    case LEVEL_DELTA_TYPE_DIE:
                        {
                            if (entity.behaviorType == BEHAVIOR_TYPE_PLAYER) {
                                // fall over
                                let duration = 1000;
                                animation = animationTweenFactory(
                                    t,
                                    duration,
                                    easingQuadraticInFactory(duration),
                                    [
                                        effectCopyMatrixIntoFactory(entityRender.headRotation, valueFactoryMatrix4InterpolationFactory(matrixCopy4(entityRender.headRotation), matrixRotateZ4(-pi / 2)))
                                    ]
                                )
                            }
                        }
                        break;
                    case LEVEL_DELTA_TYPE_CONSUME_FEATURE:
                        // wreck it
                        {

                            // look up the tile and start moving the feature toward us
                            let levelDataConsumeFeature = <LevelDeltaDataConsumeFeature>delta.deltaData;
                            let tileRender = <CompositeRender>tileRenders[levelDataConsumeFeature.fromTileX][levelDataConsumeFeature.fromTileY];
                            let featureRender = tileRender.childRenders['b'];

                            let oldTransforms = matrixCopy4(featureRender.localTransforms);
                            let oldTransform = matrixMultiplyStack4(oldTransforms);
                            let oldPosition = vectorTransform3Matrix4(0, 0, 0, oldTransform);

                            // make a drinking gesture
                            let rotationAngle = ORIENTATION_ANGLES[entity.entityOrientation];
                            let rotateY = matrixRotateY4(rotationAngle);
                            let rotateX = matrixIdentity4();
                            let scale = matrixIdentity4();
                            let translate = matrixIdentity4();
                            //let targetTransform = matrixRotateX4(pi);
                            featureRender.localTransforms.push(translate, scale, rotateY, rotateX);


                            let duration = 999;
                            animation = animationTweenFactory(
                                t,
                                duration,
                                easingQuadraticInFactory(duration),
                                [
                                    effectCopyMatrixIntoFactory(translate, valueFactoryMatrix4InterpolationFactory(matrixCopy4(translate), matrixTranslate4(0, -oldPosition[1] + .7, 0))),
                                    effectCopyMatrixIntoFactory(rotateX, valueFactoryMatrix4RotationFactory(1, 0, 0, 0, -(pi2)/3)),
                                ]
                            );

                            animation = animationChainedProxyFactory(
                                animation,
                                function (t: number) {
                                    soundEffects.powerup(1, entityRender.localTransforms);
                                    return animationChainedProxyFactory(
                                        animationTweenFactory(
                                            t,
                                            duration,
                                            easingQuadraticInFactory(duration),
                                            [
                                                effectCopyMatrixIntoFactory(scale, valueFactoryMatrix4InterpolationFactory(matrixCopy4(scale), matrixScale4(1, 0, 0))),
                                            ]
                                        ),
                                        function () {
                                            // don't actualy produce an animation, destroy the feature render
                                            delete tileRender.childRenders['b'];
                                        }
                                    );
                                }
                            )
                        }

                        break;

                }

            }
            return animation;
        },
        draw: renderDefaultDraw,
        doDraw: function(gl: WebGLRenderingContext, transformStack: Matrix4[], pickTexture: boolean): void {
            // don't actually draw the player
            let renderAll = entity.behaviorType != BEHAVIOR_TYPE_PLAYER;

            mapForEach(diceRenders, function (diceId: string, diceRenderAndIndex: RenderAndIndex) {
                let diceRender = diceRenderAndIndex.render;
                if (diceRender.animating || renderAll) {
                    let i = diceRenderAndIndex.index;
                    let diceTransformationStack = getDiceTransformationStack(i, r, 1);
                    arrayPushAll(transformStack, diceTransformationStack);
                    diceRender.draw(gl, transformStack, pickTexture);
                    arraySplice(transformStack, transformStack.length - diceTransformationStack.length, diceTransformationStack.length);
                }
            });
            if (renderAll) {
                let radius: number;
                if (entity.healthSlots > 1) {
                    radius = .11;
                } else {
                    radius = 0;
                }
                arrayForEach(healthRenders, function (healthRender: Render, i: number) {
                    if (i <= entityRender.effectiveHealth || healthRender.animating) {
                        let a = -r / 4 + (pi2 * i) / entity.healthSlots;
                        arrayPushAll(transformStack, [matrixRotateZ4(a), matrixTranslate4(0, radius, 0), matrixRotateZ4(-a), matrixRotateY4(r)]);
                        healthRender.draw(gl, transformStack, pickTexture);
                        arraySplice(transformStack, transformStack.length - 4, 4);
                    }
                });
            }
        },
        entity: entity,
        headRotation: look(-pi / 9, .3, .5),
        bodyPosition: position,
        bodyRotation: rotation,
        localTransforms: [position, rotation],
        healthRenders: healthRenders,
        diceRenders: diceRenders,
        effectiveResourceCounts: effectiveResourceCounts,
        effectiveHealth: effectiveHealth        
    }

    return entityRender;

}
