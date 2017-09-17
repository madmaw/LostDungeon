interface RenderScope {
    ambientLight: Vector3,
    pointLights: PointLight[],
    pointLightCount: number,
    projection: Matrix4,
    usePickTextures?: boolean
}

interface PointLight {
    color: Vector3,
    position: Vector3,
    rangeSquared: number
}
