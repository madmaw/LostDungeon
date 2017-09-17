///<reference path="Render.ts"/>

interface ShapeRenderParams {
    aVertexPosition: number;
    aVertexNormal: number;
    aTextureCoord: number;
    uSampler: WebGLUniformLocation;
    uWorld: WebGLUniformLocation;
    uWorldInverseTranspose: WebGLUniformLocation;
    uWorldViewProjection: WebGLUniformLocation;
    uLightPositions: WebGLUniformLocation;
    uLightColors: WebGLUniformLocation;
    uLightMaxDistancesSquared: WebGLUniformLocation;
    uLightCount: WebGLUniformLocation;
    uAmbientLight: WebGLUniformLocation;
    vertexBuffer: WebGLBuffer;
    normalBuffer: WebGLBuffer;
    indexBuffer: WebGLBuffer;
    indexBufferLength: number;
    textureCoordinatesBuffer: WebGLBuffer;
}

/*
minified at http://evanw.github.io/glslx/
*/

let MAX_LIGHTS = 16;

let shapeRenderFragmentShaderScript = `
        precision mediump float;

        varying highp vec2 vTextureCoord;
        varying mediump vec3 vNormal;
        varying mediump vec3 vSurfaceToLights[`+ MAX_LIGHTS +`];

        uniform mediump float uLightMaxDistancesSquared[`+ MAX_LIGHTS +`];
        uniform mediump vec3 uLightColors[`+ MAX_LIGHTS +`];
        uniform sampler2D uSampler;
        uniform mediump vec3 uAmbientLight;
        uniform mediump int uLightCount;

        void main(void) {
            vec3 normal = normalize(vNormal);
            vec3 totalLight = vec3(0.0, 0.0, 0.0);
            if( uLightCount > 0 ) {
                for( int i=0; i < `+ MAX_LIGHTS + `; i++ ) {
                    if( i < uLightCount ) {
                        vec3 surfaceToLight = vSurfaceToLights[i];
                        vec3 normalizedSurfaceToLight = normalize(surfaceToLight);
                        vec3 lightColor = uLightColors[i];
                        float light = dot(normal, normalizedSurfaceToLight);
                        float distanceSquared = surfaceToLight.x * surfaceToLight.x + surfaceToLight.y * surfaceToLight.y + surfaceToLight.z * surfaceToLight.z;
                        float maxDistanceSquared = uLightMaxDistancesSquared[i];
                        float distanceMult = max(0.0, (maxDistanceSquared-distanceSquared)/maxDistanceSquared);
                        totalLight += (uAmbientLight + max(vec3(0.0, 0.0, 0.0), (lightColor - uAmbientLight) * light)) * distanceMult;
                    }
                }
                totalLight = min(vec3(1.0, 1.0, 1.0), totalLight);
            } else {
                totalLight = uAmbientLight;
            }
            gl_FragColor = texture2D(uSampler, vTextureCoord);
            gl_FragColor.rgb *= totalLight;
        }
    `;

let shapeRenderVertexShaderScript = `
        attribute vec3 aVertexPosition;
        attribute vec3 aVertexNormal;
        attribute vec2 aTextureCoord;

        uniform mat4 uWorld;
        uniform mat4 uWorldViewProjection;
        uniform mat4 uWorldInverseTranspose;
        uniform vec3 uLightPositions[`+ MAX_LIGHTS +`];
        uniform mediump int uLightCount;

        varying highp vec2 vTextureCoord;
        varying mediump vec3 vNormal;
        varying mediump vec3 vSurfaceToLights[`+ MAX_LIGHTS +`];

        void main(void) {
            gl_Position = uWorldViewProjection * vec4(aVertexPosition, 1.0);
            vTextureCoord = aTextureCoord;
            vNormal = mat3(uWorldInverseTranspose) * aVertexNormal;
            for( int i=0; i < `+ MAX_LIGHTS + `; i++ ) {
                if( i < uLightCount ) {
                    vec3 lightPosition = uLightPositions[i];
                    vec3 surfaceWorldPosition = (uWorld * vec4(aVertexPosition, 1)).xyz;
                    vSurfaceToLights[i] = lightPosition - surfaceWorldPosition;
                }
            }
        }
    `;

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
    let uLightPositions = gl.getUniformLocation(program, "uLightPositions");
    let uLightMaxDistancesSquared = gl.getUniformLocation(program, "uLightMaxDistancesSquared");
    let uLightColors = gl.getUniformLocation(program, "uLightColors");
    let uMinDistanceMult = gl.getUniformLocation(program, "uMinDistanceMultiplier");
    let uLightCount = gl.getUniformLocation(program, "uLightCount");
    let uSampler = gl.getUniformLocation(program, "uSampler");
    let uAmbientLight = gl.getUniformLocation(program, "uAmbientLight");

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
        uLightPositions: uLightPositions,
        uLightMaxDistancesSquared: uLightMaxDistancesSquared,
        uLightColors: uLightColors,
        uLightCount: uLightCount,
        uAmbientLight: uAmbientLight,
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

                let lightColors = [];
                let lightPositions = [];
                let lightMaxDistancesSquared = [];
                for (let pointLight of scope.pointLights) {
                    arrayPushAll(lightPositions, pointLight.position);
                    arrayPushAll(lightColors, pointLight.color);
                    arrayPush(lightMaxDistancesSquared, pointLight.rangeSquared);
                }
                if (!scope.pointLightCount) {
                    lightColors = [0, 0, 0];
                    lightPositions = [0, 0, 0];
                    lightMaxDistancesSquared = [0];
                }

                gl.uniform3fv(params.uAmbientLight, scope.ambientLight);
                gl.uniform3fv(params.uLightPositions, lightPositions);
                gl.uniform3fv(params.uLightColors, lightColors);
                gl.uniform1fv(params.uLightMaxDistancesSquared, lightMaxDistancesSquared);
                gl.uniform1i(params.uLightCount, scope.pointLightCount);

                gl.uniformMatrix4fv(params.uWorldViewProjection, false, projectionTransform);
                gl.uniformMatrix4fv(params.uWorldInverseTranspose, false, transformInverseTranspose);
                gl.uniformMatrix4fv(params.uWorld, false, transform);

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
