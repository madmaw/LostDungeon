interface EntityRender extends Render {
    entity: Entity;
    position: Matrix4;
    rotation: Matrix4;
    facing: Matrix4;
    healthRenders: Render[],
    diceRenders: { [_: number]: Render },
    effectiveResourceCounts: { [_: number]: number },
    effectiveHealth: number
}

function entityRenderFactory(
    entity: Entity,
    position: Matrix4,
    rotation: Matrix4,
    healthRenders: Render[],
    diceRenders: { [_: number]: Render },
    tileRenders: Render[][],
    redrawInventory: () => void,
    halfDiceSize: number,
    effectiveResourceCounts: { [_: number]: number },
    effectiveHealth: number
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
            matrixTranslate4(0, (.5 - halfDiceSize * 3) * translationMultiplier, 0),
            matrixRotateZ4(-r2 * multiplier),
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
            if (delta.data && (<any>delta.data).entity == entity) {
                switch (delta.type) {
                    case LEVEL_DELTA_TYPE_MOVE:
                        {
                            let moveData = <LevelDeltaDataMove>delta.data;
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
                            let turnData = <LevelDeltaDataTurn>delta.data;
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
                                        entityRender.facing,
                                        valueFactoryMatrix4InterpolationFactory(matrixCopy4(entityRender.facing), look(-pi / 3, .5, .3))
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
                                    effectCopyMatrixIntoFactory(entityRender.facing, valueFactoryMatrix4InterpolationFactory(matrixCopy4(entityRender.facing), look(-pi / 9, .3, .5)))
                                ]

                            );
                        }
                        break;
                    case LEVEL_DELTA_TYPE_FALL:
                        {
                            let duration1 = 600;
                            let duration2 = 600;
                            let fallData = <LevelDeltaDataFall>delta.data;
                            animation = animationChainedProxyFactory(
                                animationTweenFactory(
                                    t,
                                    duration1,
                                    easingQuadraticInFactory(duration1),
                                    [
                                        effectCopyMatrixIntoFactory(entityRender.facing, valueFactoryMatrix4InterpolationFactory(matrixCopy4(entityRender.facing), look(-piOn2, -.5, 0)))
                                    ]
                                ),
                                function (t: number) {
                                    return animationTweenFactory(
                                        t,
                                        duration2,
                                        easingQuadraticOutFactory(duration2),
                                        [
                                            effectCopyMatrixIntoFactory(entityRender.facing, valueFactoryMatrix4InterpolationFactory(matrixCopy4(entityRender.facing), look(-piOn2, -1, 0)))
                                        ]
                                    );
                                }
                            );

                        }
                        break;
                    case LEVEL_DELTA_TYPE_DROP_IN:
                        {
                            let duration = 999;
                            animation = animationTweenFactory(
                                t,
                                duration,
                                easingQuadraticInFactory(duration),
                                [
                                    effectCopyMatrixIntoFactory(entityRender.facing, valueFactoryMatrix4InterpolationFactory(look(-pi / 2, 1, 0), look(-pi / 9, .3, .5)))
                                ]
                            );
                        }
                        break;
                    case LEVEL_DELTA_TYPE_COLLECT_DICE:
                        {
                            // look up the tile and remove the dice renderer
                            let collectDiceData = <LevelDeltaDataCollectDice>delta.data;
                            let tileRender = <CompositeRender>tileRenders[collectDiceData.fromTileX][collectDiceData.fromTileY];
                            let diceRender = tileRender.children[collectDiceData.fromTilePosition];
                            delete tileRender.children[collectDiceData.fromTilePosition];
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
                            let yAngle = TILE_SLOTS_ALL[collectDiceData.fromTilePosition].rotation;
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

                            diceRenders[collectDiceData.dice.diceId] = diceRender;

                            let targetTransform = matrixTranslate4(0, 0, 0);

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
                                    diceRender.animating = false;
                                }
                            )
                        }
                        break;
                    case LEVEL_DELTA_TYPE_PLAY_DICE:
                        {
                            redrawInventory();
                            let playDiceData = <LevelDeltaDataPlayDice>delta.data;
                            let playedDiceRender = diceRenders[playDiceData.dice.diceId];
                            delete diceRenders[playDiceData.dice.diceId];
                            let toTileRender = <CompositeRender>tileRenders[playDiceData.toTileX][playDiceData.toTileY];
                            toTileRender.children[playDiceData.toTilePosition] = playedDiceRender;
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

                            // TODO use this to have a throwing motion
                            let sourceDropHeight = matrixIdentity4();
                            let targetDropHeight = matrixTranslate4(0, (entity.lookingDown?.2:.4) + random()/7, 0);

                            let offsetSpin = matrixMultiplyStack4(getDiceTransformationStack(playDiceData.fromDiceSlot, 1, 0));

                            let sourceDiceFaceRotation = matrixIdentity4();
                            let targetDiceFaceRotation = DICE_FACE_ROTATIONS[playDiceData.toFace];


                            let rotationY = matrixCopy4(rotation);
                            let rotationYFrom = ORIENTATION_ANGLES[entity.entityOrientation];
                            let rotationYTo = TILE_SLOTS_ALL[playDiceData.toTilePosition].rotation;

                            playedDiceRender.localTransforms = [
                                sourceTranslate,
                                sourceDropHeight,
                                rotationY,
                                offsetSpin,
                                sourceDiceFaceRotation
                            ];

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
                                animationTweenFactory(
                                    t,
                                    duration2,
                                    easingQuadraticOutFactory(duration2/2),
                                    [
                                        effectCopyMatrixIntoFactory(sourceDropHeight, valueFactoryMatrix4InterpolationFactory(matrixCopy4(sourceDropHeight), targetDropHeight))
                                    ]
                                )
                            ]);

                        }
                        break;
                    case LEVEL_DELTA_TYPE_RESOURCE_CHANGE:
                        {
                            let levelDeltaDataResourceChange = <LevelDeltaDataResourceChange>delta.data;
                            entityRender.effectiveResourceCounts = levelDeltaDataResourceChange.newEffectiveResourceCounts;
                            if (levelDeltaDataResourceChange.entity.behaviorType == BEHAVIOR_TYPE_PLAYER) {
                                redrawInventory();
                            }
                        }
                        break;
                    case LEVEL_DELTA_TYPE_HEALTH_CHANGE:
                        {
                            let levelDeltaDataHealthChange = <LevelDeltaDataHealthChange>delta.data;
                            entityRender.effectiveHealth = levelDeltaDataHealthChange.totalHealth;
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
                                            effectCopyMatrixIntoFactory(entityRender.facing, valueFactoryMatrix4InterpolationFactory(matrixCopy4(entityRender.facing), matrixRotate4(random(), random(), random(), pi/6)))
                                        ]
                                    )
                                }
                                redrawInventory();
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
                                        effectCopyMatrixIntoFactory(entityRender.facing, valueFactoryMatrix4InterpolationFactory(matrixCopy4(entityRender.facing), matrixRotateZ4(-pi / 2)))
                                    ]
                                )
                            }
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

            mapForEach(diceRenders, function (diceId: string, diceRender: Render) {
                if (diceRender.animating || renderAll) {
                    let i;
                    arrayForEach(entity.dice, function (dice: Dice, index: number) {
                        if (dice && dice.diceId == <any>diceId) {
                            i = index;
                        }
                    });
                    let diceTransformationStack = getDiceTransformationStack(i, r, 1);
                    arrayPushAll(transformStack, diceTransformationStack);
                    diceRender.draw(gl, transformStack, pickTexture);
                    transformStack.splice(transformStack.length - diceTransformationStack.length, diceTransformationStack.length);
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
                        let a = -r / 2 + (pi2 * i) / entity.healthSlots;
                        transformStack.push(matrixRotateZ4(a), matrixTranslate4(0, radius, 0), matrixRotateZ4(-a), matrixRotateY4(r));
                        healthRender.draw(gl, transformStack, pickTexture);
                        transformStack.splice(transformStack.length - 4, 4);
                    }
                });
            }
        },
        entity: entity,
        facing: look(-pi / 9, .3, .5),
        position: position,
        rotation: rotation,
        localTransforms: [position, rotation],
        healthRenders: healthRenders,
        diceRenders: diceRenders,
        effectiveResourceCounts: effectiveResourceCounts,
        effectiveHealth: effectiveHealth        
    }

    return entityRender;

}
