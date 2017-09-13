///<reference path="Lost/StateTypeId.ts"/>
// TODO we can remove this for Grunt build to save space
w.onload = function() {
    let levelPopulator = levelPopulatorTileMazeFactory(.1, .4, 1, .5);
    let gameService: GameService = localStorageGameServiceFactory('l');
    let stateFactories: { [_: number]: StateFactory } = {};
    let localHomeStateFactory = homeStateFactory(gameService);

    var audioContext: AudioContext;
    if (FEATURE_SOUND) {
        if (w["AudioContext"]) {
            audioContext = new AudioContext();
        } else if (w["webkitAudioContext"]) {
            audioContext = new w["webkitAudioContext"]();
        }
    }

    stateFactories[STATE_TYPE_HOME] = localHomeStateFactory;
    stateFactories[STATE_TYPE_PLAY] = playStateFactory(audioContext, gameService, levelPopulator, localHomeStateFactory);
    let stateFactory = delegatingStateFactory(stateFactories);

    let currentState: State;
    let stateListener = function(stateTypeId: StateTypeId, data?: StateData) {
        if (currentState) {
            currentState.destroyState();
        }
        currentState = stateFactory(stateTypeId, data);
        if (currentState) {
            currentState.initState(stateListener);
        }
    };
    stateListener(STATE_TYPE_HOME);
};
