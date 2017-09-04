///<reference path="Lost/StateTypeId.ts"/>
// TODO we can remove this for Grunt build to save space
w.onload = function () {
    let levelPopulator = levelPopulatorTileMazeFactory(.1, .4, 1, .5);
    let gameService: GameService = new LocalStorageGameService('l');
    let stateFactories: { [_: number]: StateFactory } = {};
    stateFactories[STATE_TYPE_HOME] = homeStateFactory(gameService);
    stateFactories[STATE_TYPE_PLAY] = playStateFactory(gameService, levelPopulator);
    let stateFactory = delegatingStateFactory(stateFactories);

    let currentState;
    let stateListener = function (stateTypeId: StateTypeId, data?: StateData) {
        if (currentState) {
            currentState.stop();
            currentState.destroy();
        }
        currentState = stateFactory(stateTypeId, data);
        if (currentState) {
            currentState.init(stateListener);
            currentState.start();
        }
    };
    stateListener(STATE_TYPE_HOME);
};
