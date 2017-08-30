interface Entity {
    id: EntityId;
    orientation: Orientation;
    side: number;
    behaviorType: BehaviorType;
    lookingDown?: boolean;
    dice: Dice[];
}
