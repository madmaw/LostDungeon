///<reference path="Render.ts"/>

interface ShapeRenderParams {
    aVertexPosition: number;
    aTextureCoord: number;
    uTransform: WebGLUniformLocation;
    uSampler: WebGLUniformLocation;
    vertexBuffer: WebGLBuffer;
    indexBuffer: WebGLBuffer;
    indexBufferLength: number;
    textureCoordinatesBuffer: WebGLBuffer;
}

/*
minified at http://evanw.github.io/glslx/

let shapeRenderFragmentShaderScript = `
        varying highp vec2 vTextureCoord;
        uniform sampler2D uSampler;
        void main(void) {
            gl_FragColor = texture2D(uSampler, vTextureCoord);
        }
    `;

let shapeRenderVertexShaderScript = `
        attribute vec3 aVertexPosition;
        attribute vec2 aTextureCoord;
        uniform mat4 uTransform;
        varying highp vec2 vTextureCoord;
        void main(void) {
            gl_Position = uTransform * vec4(aVertexPosition, 1.0);
            vTextureCoord = aTextureCoord;
        }
    `;
*/
let shapeRenderFragmentShaderScript = 'varying highp vec2 d;uniform sampler2D e;void main(){gl_FragColor=texture2D(e,d);}';
let shapeRenderVertexShaderScript = 'attribute vec3 a;attribute vec2 b;uniform mat4 c;varying highp vec2 d;void main(){gl_Position=c*vec4(a,1),d=b;}';

function shapeRenderInit(
    gl: WebGLRenderingContext,
    program: WebGLProgram,
    vertices: number[],
    indices: number[],
    textureCoordinates: number[]
): ShapeRenderParams {
    let uTransform = gl.getUniformLocation(program, "c");
    let uSampler = gl.getUniformLocation(program, "e");

    let aVertexPosition = gl.getAttribLocation(program, "a");
    let aTextureCoord = gl.getAttribLocation(program, "b");

    let vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    let indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    let textureCoordinatesBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordinatesBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);

    return {
        indexBuffer: indexBuffer,
        vertexBuffer: vertexBuffer,
        aVertexPosition: aVertexPosition,
        indexBufferLength: indices.length,
        uTransform: uTransform,
        aTextureCoord: aTextureCoord,
        uSampler: uSampler,
        textureCoordinatesBuffer: textureCoordinatesBuffer
    };
}

function shapeRenderFactory(
    localTransforms: Matrix4[],
    params: ShapeRenderParams,
    normalTexture: WebGLTexture,
    pickTexture?: WebGLTexture
): Render {
    return {
        localTransforms: localTransforms,
        draw: renderDefaultDraw,
        doDraw: function (gl: WebGLRenderingContext, transformStack: Matrix4[], usePickTexture: boolean) {
            let texture = usePickTexture ? pickTexture : normalTexture;
            if (texture) {
                let transform = matrixMultiplyStack4(transformStack);

                // vertices
                gl.bindBuffer(gl.ARRAY_BUFFER, params.vertexBuffer);
                gl.vertexAttribPointer(params.aVertexPosition, 3, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(params.aVertexPosition);

                // texture coordinates
                gl.bindBuffer(gl.ARRAY_BUFFER, params.textureCoordinatesBuffer);
                gl.vertexAttribPointer(
                    params.aTextureCoord,
                    2,
                    gl.FLOAT,
                    false,
                    0,
                    0
                );
                gl.enableVertexAttribArray(params.aTextureCoord);

                // indices
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, params.indexBuffer);

                gl.uniformMatrix4fv(params.uTransform, false, transform);

                // texture
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.uniform1i(params.uSampler, 0);

                // draw
                gl.drawElements(gl.TRIANGLES, params.indexBufferLength, gl.UNSIGNED_SHORT, 0);

            }
        }
    }
}
