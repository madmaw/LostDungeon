function getBestAvailableTileSlotKey(tileSlots: { [_: number]: TileSlot }, tile: Tile, targetDiffX: number, targetDiffY: number): string {
    let targetSlot: TileSlot;
    let targetSlotKey: string;
    mapForEach(tileSlots, (key: string, slot: TileSlot) => {
        if (!tile.dice[key]) {
            let ok = !targetSlot;
            if (!ok) {
                // check the deltas
                let dx = targetDiffX - slot.dx;
                let dy = targetDiffY - slot.dy;
                let currentDx = targetDiffX - targetSlot.dx;
                let currentDy = targetDiffY - targetSlot.dy;
                ok = (dx * dx + dy * dy < currentDx * currentDx + currentDy * currentDy);
            }
            if (ok) {
                targetSlot = slot;
                targetSlotKey = key;
            }
        }
    });
    return targetSlotKey;
}
