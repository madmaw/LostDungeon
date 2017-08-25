function matrixPerspective4(fovy, aspect, znear, zfar): Matrix4 {

    /*
    var fieldOfViewInRadians = fovy * Math.PI / 180;
    var f = 1.0 / Math.tan(fieldOfViewInRadians / 2);
    var rangeInv = 1 / (near - far);

    return [
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (near + far) * rangeInv, -1,
        0, 0, near * far * rangeInv * 2, 0
    ];
    */

    var top = znear * Math.tan(fovy * Math.PI / 360.0);
    var bottom = -top;
    var left = bottom * aspect;
    var right = top * aspect;

    //return makeFrustum(xmin, xmax, ymin, ymax, znear, zfar);

    var X = 2 * znear / (right - left);
    var Y = 2 * znear / (top - bottom);
    var A = (right + left) / (right - left);
    var B = (top + bottom) / (top - bottom);
    var C = -(zfar + znear) / (zfar - znear);
    var D = -2 * zfar * znear / (zfar - znear);

    return [
        X, 0, 0, 0,
        0, Y, 0, 0,
        A, B, C, -1,
        0, 0, D, 0
    ];

}
