interface LevelDelta {
    type: LevelDeltaType;
    data?: LevelDeltaData;
    children?: LevelDelta[];
}
