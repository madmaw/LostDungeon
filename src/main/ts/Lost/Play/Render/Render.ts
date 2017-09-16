

interface Render {

    animating?: boolean;
    localTransforms: Matrix4[];

    update?: (t: number) => void;

    consume?: (t: number, delta: LevelDelta) => Animation;

    draw(gl: WebGLRenderingContext, transformStack: Matrix4[], scope: RenderScope): void;

    doDraw(gl: WebGLRenderingContext, transformStack: Matrix4[], scope: RenderScope): void;
}

function renderDefaultDraw(gl: WebGLRenderingContext, transformStack: Matrix4[], scope: RenderScope) {
    let render: Render = this;
    arrayPushAll(transformStack, render.localTransforms);
    render.doDraw(gl, transformStack, scope);
    let length = render.localTransforms.length;
    arraySplice(transformStack, transformStack.length - length, length);

}
