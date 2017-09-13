interface State {

    stateElementId: string;
    stateElement?: HTMLElement;
    stateListener?: StateListener;
    eventListeners?: { [_: string]: EventListenerOrEventListenerObject };

    initState(stateListener: StateListener): void;

    destroyState();

}

function stateDefaultInit(state: State, stateListener: StateListener, eventListeners?: { [_: string]: EventListenerOrEventListenerObject }): void {
    state.stateElement = getElemById(state.stateElementId);
    state.stateElement.removeAttribute('class');
    state.stateListener = stateListener;
    mapForEach(eventListeners, function (name: string, eventListener: EventListenerOrEventListenerObject) {
        w.addEventListener(name, eventListener, <any>{ passive: false });
    });
    state.eventListeners = eventListeners;
}

function stateDefaultDestroy() {
    let state: State = this;
    setAttrib(state.stateElement, 'class', 'h');
    mapForEach(state.eventListeners, function (name: string, eventListener: EventListenerOrEventListenerObject) {
        w.removeEventListener(name, eventListener, <any>{ passive: false });
    });
}

