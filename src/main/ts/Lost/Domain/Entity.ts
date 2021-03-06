interface EntityPersonality {
    playDiceSymbolWeights: number[];
    collectDiceSymbolWeights: number[];
    randomness: number;
}

interface Entity {
    id: EntityId;
    entityOrientation: Orientation;
    side?: number;
    behaviorType: BehaviorType;
    lookingDown?: boolean;
    dice: Dice[];
    resourceCounts: { [_: number]: number };
    diceSlots: number;
    healthSlots: number;
    dead?: boolean;
    personality?: EntityPersonality;
    entityType: EntityType;
}
