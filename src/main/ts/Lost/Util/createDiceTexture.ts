function createDiceTexture(width: number, height: number, textureCoordinates: number[], dice: Dice): HTMLCanvasElement {
    let canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    let ctx = canvas.getContext('2d');

    let backgroundColor = DICE_TYPE_COLORS[dice.type];
    
    ctx.strokeStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle'

    for (let side = 0; side < 6; side++) {
        let symbols = dice.symbols[side];
        let textureCoordinateOffset = side * 8;
        let xa = width * textureCoordinates[textureCoordinateOffset];
        let ya = height * textureCoordinates[textureCoordinateOffset + 1];
        let xb = width * textureCoordinates[textureCoordinateOffset + 4];
        let yb = height * textureCoordinates[textureCoordinateOffset + 5];

        let x1 = min(xa, xb);
        let y1 = min(ya, yb);
        let x2 = max(xa, xb);
        let y2 = max(ya, yb);

        let dw = x2 - x1;
        let dh = y2 - y1;

        let gradient = ctx.createRadialGradient(x1 + dw / 2, y1 + dh / 2, dh /4, x1 + dw / 2, y1 + dh / 2, dh*2);
        gradient.addColorStop(0, backgroundColor);
        gradient.addColorStop(1, '#000');
        ctx.fillStyle = gradient;
        ctx.fillRect(x1, y1, dw, dh);

        let symbolCount = symbols.length;
        if (symbolCount) {
            //let span = Math.floor(Math.sqrt(symbolCount));
            let span = 2;
            let cellSize = dh / span;
            let cx = 0;
            let cy = 0;
            ctx.font = '' + (cellSize *.9) + 'px serif';

            for (let i in symbols) {
                let symbol = symbols[i];
                let character = DICE_SYMBOL_CHARACTERS[symbol];
                let color = DICE_SYMBOL_COLORS[symbol];
                let angleOffset = DICE_SYMBOL_ROTATION[symbol];
                if (!color) {
                    color = backgroundColor;
                }
                
                //let angle = (pi * 2 * <any>i) / (span * span) - pi/4 + pi;
                let tx = cx + cellSize / 2;
                let ty = cy + cellSize / 2;
                let angle = Math.atan2(ty - dh / 2, tx - dw / 2) + angleOffset;
                ctx.save();

                ctx.translate(x1 + tx, y1 + ty);
                ctx.rotate(angle);
                ctx.fillStyle = color;
                ctx.fillText(character, 0, 0);
                ctx.strokeText(character, 0, 0);
                ctx.restore();

                cx += cellSize;
                if ((<any>i % span) == span - 1) {
                    cx = 0;
                    cy += cellSize;
                }
            }
        }
        if (dice.level) {
            let levelFontSize = dh / 3;
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(x1 + dw / 2, y1 + dh / 2, levelFontSize / 2, pi, -pi);
            ctx.fill();
            ctx.font = '' + levelFontSize + 'px serif';
            ctx.fillStyle = '#fff';
            ctx.fillText(<any>dice.level, x1 + dw / 2, y1 + dh / 2);
        }


    }
    return canvas;

}
