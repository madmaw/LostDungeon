interface RenderScope {
    lightLocations: number[],
    lightCount: number,
    projection: Matrix4,
    ambientLight: number,
    maxDistanceSquared: number,
    minDistanceMult: number,
    usePickTextures?: boolean
}
