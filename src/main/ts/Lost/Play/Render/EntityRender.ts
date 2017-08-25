class EntityRender extends Render {

    constructor(
        public entity: Entity,
        public position: Matrix4,
        public rotation: Matrix4,
        private shape: WebGLBuffer,
        private shapeAttribute: number,
        private transformationUniformLocation: WebGLUniformLocation
    ) {
        super([position, rotation]);
    }

    consume(t: number, delta: LevelDelta): Animation {
        let animation: Animation;
        switch (delta.type) {
            case LEVEL_DELTA_TYPE_MOVE:
                let moveData = <LevelDeltaDataMove>delta.data;
                let dpos = ORIENTATION_DIFFS[moveData.direction];
                let targetPosition = matrixTranslate4(moveData.fromX + dpos.x, 0, moveData.fromY + dpos.y);
                animation = animationTweenFactory(t, easingQuadraticFactory(.005), effectSetPropertyFactory(this, 'position', valueFactoryMatrix4InterpolationFactory(matrixCopy4(this.position), targetPosition)));
                break;
            case LEVEL_DELTA_TYPE_TURN:
                let turnData = <LevelDeltaDataTurn>delta.data;
                let fromAngle = ORIENTATION_ANGLES[turnData.fromOrientation];
                let toAngle = ORIENTATION_ANGLES[turnData.toOrientation];
                while (toAngle < fromAngle) {
                    toAngle += Math.PI * 2;
                }
                let angle = toAngle - fromAngle;
                while (angle > Math.PI) {
                    angle -= Math.PI * 2;
                }
                let targetRotation = matrixRotateY4(toAngle);
                animation = animationTweenFactory(t, easingQuadraticFactory(.003 * Math.abs(angle)), effectSetPropertyFactory(this, 'rotation', valueFactoryMatrix4InterpolationFactory(matrixCopy4(this.rotation), targetRotation)))
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
