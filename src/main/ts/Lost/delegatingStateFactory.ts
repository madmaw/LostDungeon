function delegatingStateFactory(stateFactories: { [_: number]: StateFactory }): StateFactory {
    return function (stateTypeId: StateTypeId, data: StateData) {
        return stateFactories[stateTypeId](stateTypeId, data);
    }
}