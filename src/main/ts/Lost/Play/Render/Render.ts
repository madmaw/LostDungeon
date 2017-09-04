abstract class Render {

    public animating: boolean;

    constructor(public localTransforms: Matrix4[]) {

    }

    update(t: number): void {

    }

    consume(t: number, delta: LevelDelta): Animation {
        return null;
    }

    draw(gl: WebGLRenderingContext, transformStack: Matrix4[], pickTextures:boolean): void {
        for (let localTransform of this.localTransforms) {
            transformStack.push(localTransform);
        }
        this.doDraw(gl, transformStack, pickTextures);
        let length = this.localTransforms.length;
        transformStack.splice(transformStack.length - length, length);
    }

    abstract doDraw(gl: WebGLRenderingContext, transformStack: Matrix4[], pickTextures: boolean): void;
}
