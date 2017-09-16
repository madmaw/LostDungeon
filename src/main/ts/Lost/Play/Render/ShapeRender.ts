///<reference path="Render.ts"/>

interface ShapeRenderParams {
    aVertexPosition: number;
    aVertexNormal: number;
    aTextureCoord: number;
    uSampler: WebGLUniformLocation;
    uWorld: WebGLUniformLocation;
    uWorldInverseTranspose: WebGLUniformLocation;
    uWorldViewProjection: WebGLUniformLocation;
    uLightPosition: WebGLUniformLocation;
    uAmbientLight: WebGLUniformLocation;
    uMinDistanceMult: WebGLUniformLocation;
    uMaxDistanceSquared: WebGLUniformLocation;
    vertexBuffer: WebGLBuffer;
    normalBuffer: WebGLBuffer;
    indexBuffer: WebGLBuffer;
    indexBufferLength: number;
    textureCoordinatesBuffer: WebGLBuffer;
}

/*
minified at http://evanw.github.io/glslx/
*/

let shapeRenderFragmentShaderScript = `
        precision mediump float;

        varying highp vec2 vTextureCoord;
        varying mediump vec3 vNormal;
        varying mediump vec3 vSurfaceToLight;

        uniform sampler2D uSampler;
        uniform mediump float uAmbientLight;
        uniform mediump float uMinDistanceMultiplier;
        uniform mediump float uMaxDistanceSquared;

        void main(void) {
            vec3 normal = normalize(vNormal);
            vec3 surfaceToLight = normalize(vSurfaceToLight);
            float light = dot(normal, surfaceToLight);
            float distanceSquared = vSurfaceToLight.x * vSurfaceToLight.x + vSurfaceToLight.y * vSurfaceToLight.y + vSurfaceToLight.z * vSurfaceToLight.z;
            float distanceMult = max(uMinDistanceMultiplier, (uMaxDistanceSquared - distanceSquared) / uMaxDistanceSquared);

            gl_FragColor = texture2D(uSampler, vTextureCoord);
            gl_FragColor.rgb *= (uAmbientLight + light * (1.0 - uAmbientLight)) * distanceMult;
        }
    `;

let shapeRenderVertexShaderScript = `
        attribute vec3 aVertexPosition;
        attribute vec3 aVertexNormal;
        attribute vec2 aTextureCoord;

        uniform mat4 uWorld;
        uniform mat4 uWorldViewProjection;
        uniform mat4 uWorldInverseTranspose;
        uniform vec3 uLightPosition;

        varying highp vec2 vTextureCoord;
        varying mediump vec3 vNormal;
        varying mediump vec3 vSurfaceToLight;

        void main(void) {
            gl_Position = uWorldViewProjection * vec4(aVertexPosition, 1.0);
            vTextureCoord = aTextureCoord;
            vNormal = mat3(uWorldInverseTranspose) * aVertexNormal;

            vec3 surfaceWorldPosition = (uWorld * vec4(aVertexPosition, 1)).xyz;
            vSurfaceToLight = uLightPosition - surfaceWorldPosition;
        }
    `;
//let shapeRenderFragmentShaderScript = 'varying highp vec2 d;uniform sampler2D e;void main(){gl_FragColor=texture2D(e,d);}';
//let shapeRenderVertexShaderScript = 'attribute vec3 a;attribute vec2 b;uniform mat4 c;varying highp vec2 d;void main(){gl_Position=c*vec4(a,1),d=b;}';

function shapeRenderInit(
    gl: WebGLRenderingContext,
    program: WebGLProgram,
    vertices: number[],
    normals: number[],
    indices: number[],
    textureCoordinates: number[]
): ShapeRenderParams {
    let uWorld = gl.getUniformLocation(program, "uWorld");
    let uWorldInverseTranspose = gl.getUniformLocation(program, "uWorldInverseTranspose");
    let uWorldViewProjection = gl.getUniformLocation(program, "uWorldViewProjection");
    let uLightPosition = gl.getUniformLocation(program, "uLightPosition");
    let uSampler = gl.getUniformLocation(program, "uSampler");
    let uAmbientLight = gl.getUniformLocation(program, "uAmbientLight");
    let uMaxDistanceSquared = gl.getUniformLocation(program, "uMaxDistanceSquared");
    let uMinDistanceMult = gl.getUniformLocation(program, "uMinDistanceMultiplier");

    let aVertexPosition = gl.getAttribLocation(program, "aVertexPosition");
    let aVertexNormal = gl.getAttribLocation(program, "aVertexNormal");
    let aTextureCoord = gl.getAttribLocation(program, "aTextureCoord");

    let vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    let normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

    let indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    let textureCoordinatesBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordinatesBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);

    return {
        indexBuffer: indexBuffer,
        vertexBuffer: vertexBuffer,
        normalBuffer: normalBuffer,
        aVertexPosition: aVertexPosition,
        aVertexNormal: aVertexNormal,
        indexBufferLength: indices.length,
        uWorld: uWorld,
        uWorldInverseTranspose: uWorldInverseTranspose,
        uWorldViewProjection: uWorldViewProjection,
        uLightPosition: uLightPosition,
        uAmbientLight: uAmbientLight,
        uMaxDistanceSquared: uMaxDistanceSquared,
        uMinDistanceMult: uMinDistanceMult,
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
        doDraw: function (gl: WebGLRenderingContext, transformStack: Matrix4[], scope: RenderScope) {
            let texture = scope.usePickTextures ? pickTexture : normalTexture;
            if (texture) {
                let transform = matrixMultiplyStack4(transformStack);

                // vertices
                gl.bindBuffer(gl.ARRAY_BUFFER, params.vertexBuffer);
                gl.vertexAttribPointer(params.aVertexPosition, 3, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(params.aVertexPosition);

                // normals
                gl.bindBuffer(gl.ARRAY_BUFFER, params.normalBuffer);
                gl.vertexAttribPointer(params.aVertexNormal, 3, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(params.aVertexNormal);

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

                let projectionTransform = matrixMultiply4(scope.projection, transform);
                let transformInverseTranspose = matrixTranspose4(matrixInvert4(transform));

                gl.uniformMatrix4fv(params.uWorld, false, transform);
                gl.uniformMatrix4fv(params.uWorldViewProjection, false, projectionTransform);
                gl.uniformMatrix4fv(params.uWorldInverseTranspose, false, transformInverseTranspose);
                gl.uniform1f(params.uAmbientLight, scope.ambientLight);
                gl.uniform1f(params.uMinDistanceMult, scope.minDistanceMult);
                gl.uniform1f(params.uMaxDistanceSquared, scope.maxDistanceSquared);

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
