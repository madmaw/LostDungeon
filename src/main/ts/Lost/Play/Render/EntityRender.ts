class EntityRender extends Render {
    public facing: Matrix4;

    constructor(
        public entity: Entity,
        public position: Matrix4,
        public rotation: Matrix4,
        private shape: WebGLBuffer,
        private shapeAttribute: number,
        private transformationUniformLocation: WebGLUniformLocation
    ) {
        super([position, rotation]);
        this.facing = this.look(-pi/99, .5, .5);
    }

    look(radians: number, height: number, stepBack): Matrix4 {
        return matrixMultiply4(matrixRotateX4(radians), matrixTranslate4(0, -height, -stepBack))
    }

    consume(t: number, delta: LevelDelta): Animation {
        let animation: Animation;
        switch (delta.type) {
            case LEVEL_DELTA_TYPE_MOVE:
                let moveData = <LevelDeltaDataMove>delta.data;
                let dpos = ORIENTATION_DIFFS[moveData.direction];
                let targetPosition = matrixTranslate4(moveData.fromX + dpos.x, 0, moveData.fromY + dpos.y);
                animation = animationTweenFactory(
                    t,
                    easingQuadraticFactory(.004),
                    effectSetPropertyFactory(this, 'position', valueFactoryMatrix4InterpolationFactory(matrixCopy4(this.position), targetPosition))
                );
                break;
            case LEVEL_DELTA_TYPE_TURN:
                let turnData = <LevelDeltaDataTurn>delta.data;
                let fromAngle = ORIENTATION_ANGLES[turnData.fromOrientation];
                let toAngle = ORIENTATION_ANGLES[turnData.toOrientation];
                while (toAngle < fromAngle) {
                    toAngle += pi * 2;
                }
                let angle = toAngle - fromAngle;
                while (angle > Math.PI) {
                    angle -= pi * 2;
                }
                let targetRotation = matrixRotateY4(toAngle);
                animation = animationTweenFactory(
                    t,
                    easingQuadraticFactory(.002 * Math.abs(angle)),
                    effectSetPropertyFactory(this, 'rotation', valueFactoryMatrix4InterpolationFactory(matrixCopy4(this.rotation), targetRotation))
                );
                break;
            case LEVEL_DELTA_TYPE_LOOK_DOWN:
                animation = animationTweenFactory(
                    t,
                    easingQuadraticFactory(.004),
                    effectSetPropertyFactory(
                        this,
                        'facing',
                        valueFactoryMatrix4InterpolationFactory(matrixCopy4(this.facing), this.look(-pi / 3, .75, .3))
                    )
                );
                break;
            case LEVEL_DELTA_TYPE_LOOK_UP:
                animation = animationTweenFactory(
                    t,
                    easingQuadraticFactory(.004),
                    effectSetPropertyFactory(this, 'facing', valueFactoryMatrix4InterpolationFactory(matrixCopy4(this.facing), this.look(-pi / 99, .5, .5)))
                );
                break;
            case LEVEL_DELTA_TYPE_FALL:
                let fallData = <LevelDeltaDataFall>delta.data;
                animation = animationChainedProxyFactory(
                    animationTweenFactory(
                        t,
                        easingQuadraticFactory(.002),
                        effectSetPropertyFactory(this, 'facing', valueFactoryMatrix4InterpolationFactory(matrixCopy4(this.facing), this.look(-pi / 2, 0, 0)))
                    ),
                    (t: number) => {
                        return animationTweenFactory(
                            t,
                            easingQuadraticFactory(.009),
                            effectSetPropertyFactory(this, 'facing', valueFactoryMatrix4InterpolationFactory(matrixCopy4(this.facing), this.look(-pi / 2, -1, 0)))
                        );
                    }
                );
                break;
            case LEVEL_DELTA_TYPE_DROP_IN:
                animation = animationTweenFactory(
                    t,
                    easingQuadraticFactory(.001),
                    effectSetPropertyFactory(this, 'facing', valueFactoryMatrix4InterpolationFactory(this.look(-pi / 2, 1.5, 0), this.look(-pi / 99, .5, .5)))
                );
                break;
        }
        return animation;
    }

    doDraw(gl: WebGLRenderingContext, transformStack: Matrix4[]): void {
        // don't actually draw the player
        if (this.entity.behaviorType != BEHAVIOR_TYPE_PLAYER) {
            let transform = matrixMultiplyStack4(transformStack);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.shape);
            gl.uniformMatrix4fv(this.transformationUniformLocation, false, new Float32Array(transform));
            gl.vertexAttribPointer(this.shapeAttribute, 3, gl.FLOAT, false, 0, 0);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }

    }
}
