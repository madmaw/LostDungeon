function webglGetShader(gl: WebGLRenderingContext, theSource: string, type: number) {
    var shader;

    shader = gl.createShader(type);
    // Send the source to the shader object

    gl.shaderSource(shader, theSource);

    // Compile the shader program

    gl.compileShader(shader);

    // See if it compiled successfully
    if (FEATURE_CHECK_SHADER_ERRORS) {
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw gl.getShaderInfoLog(shader);
        }
    }

    return shader;
}
