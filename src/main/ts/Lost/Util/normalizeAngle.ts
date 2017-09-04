function normalizeAngle(angle: number, against: number): number {
    while (angle < against - pi) {
        angle += pi2;
    }
    while (angle > against + pi) {
        angle -= pi2;
    }
    return angle;
}
