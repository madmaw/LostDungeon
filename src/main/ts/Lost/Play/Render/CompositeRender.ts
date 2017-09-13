///<reference path="Render.ts"/>

interface CompositeRender extends Render {
    childRenders: { [_: string]: Render };
}

function compositeRenderFactory(localTransforms: Matrix4[], childRenders: { [_: string]: Render }): CompositeRender {
    let render = {
        childRenders: childRenders,
        draw: renderDefaultDraw,
        localTransforms: localTransforms,
        doDraw: function (gl: WebGLRenderingContext, transformStack: Matrix4[], pickTextures: boolean) {
            mapForEach(render.childRenders, function (key: string, child: Render) {
                child.draw(gl, transformStack, pickTextures);
            });
        }
    };
    return render;
}
