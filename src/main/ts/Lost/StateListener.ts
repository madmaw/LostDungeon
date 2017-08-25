interface StateListener {
    (stateTypeId: StateTypeId, data?: StateData): void;
}