interface StateFactory {
    (stateTypeId: StateTypeId, data?: StateData): State<HTMLElement>;
}