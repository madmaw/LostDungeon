interface Entity {
    id: number;
    orientation: Orientation;
    side: number;
    behaviorType: BehaviorType;
    lookingDown?: boolean;
}
