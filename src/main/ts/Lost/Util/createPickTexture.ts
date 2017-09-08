function createPickTexture(id: number): HTMLCanvasElement {
    let width = 32;
    let height = 32;
    let canvas = createCanvas(width, height);
    let ctx = canvas.getContext('2d');

    let color = id.toString(16);
    while (color.length < 6) {
        color = '0' + color;
    }
    color = '#' + color;


    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);

    return canvas;
}
