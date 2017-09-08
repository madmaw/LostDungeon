

interface Render {

    animating?: boolean;
    localTransforms: Matrix4[];

    update?: (t: number) => void;

    consume?: (t: number, delta: LevelDelta) => Animation;

    draw(gl: WebGLRenderingContext, transformStack: Matrix4[], pickTextures: boolean): void;

    doDraw(gl: WebGLRenderingContext, transformStack: Matrix4[], pickTextures: boolean): void;
}

function renderDefaultDraw(gl: WebGLRenderingContext, transformStack: Matrix4[], pickTextures: boolean) {
    let render: Render = this;
    arrayPushAll(transformStack, render.localTransforms);
    render.doDraw(gl, transformStack, pickTextures);
    let length = render.localTransforms.length;
    transformStack.splice(transformStack.length - length, length);

}
