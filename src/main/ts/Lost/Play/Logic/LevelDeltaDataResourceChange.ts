interface LevelDeltaDataResourceChange {
    entity: Entity;
    newEffectiveResourceCounts: { [_: number]: number };
    resourceDeltas: { [_: number]: number };
}
