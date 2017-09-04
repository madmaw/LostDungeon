///<reference path="Render.ts"/>

class CompositeRender extends Render {

    constructor(
        localTransforms: Matrix4[],
        public children: {[_:string]: Render}
    ) {
        super(localTransforms);
    }

    doDraw(gl: WebGLRenderingContext, transformStack: Matrix4[], pickTextures: boolean): void {
        for (let key in this.children) {
            let child = this.children[key];
            child.draw(gl, transformStack, pickTextures);
        }
    }

}
