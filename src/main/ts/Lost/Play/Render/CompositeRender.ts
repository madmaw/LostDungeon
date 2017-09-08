///<reference path="Render.ts"/>

interface CompositeRender extends Render {
    children: { [_: string]: Render };
}

function compositeRenderFactory(localTransforms: Matrix4[], children: { [_: string]: Render }): CompositeRender {
    let result = {
        children: children,
        draw: renderDefaultDraw,
        localTransforms: localTransforms,
        doDraw: function (gl: WebGLRenderingContext, transformStack: Matrix4[], pickTextures: boolean) {
            mapForEach(result.children, function (key: string, child: Render) {
                child.draw(gl, transformStack, pickTextures);
            });
        }
    };
    return result;
}
