function createCanvas(width: number, height: number) {
    let canvas = <HTMLCanvasElement>createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}
