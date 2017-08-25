///<reference path="Lost/StateTypeId.ts"/>
// TODO we can remove this for Grunt build to save space
let pi = Math.PI;
window.onload = function() {
    let gameService: GameService = new LocalStorageGameService('l');
    let stateFactories: { [_: number]: StateFactory } = {};
    stateFactories[STATE_TYPE_HOME] = homeStateFactory(gameService);
    stateFactories[STATE_TYPE_PLAY] = playStateFactory(gameService);
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
