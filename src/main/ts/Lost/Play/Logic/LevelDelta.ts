interface LevelDelta {
    deltaType: LevelDeltaType;
    deltaData?: LevelDeltaData;
    deltaChildren?: LevelDelta[];
}
