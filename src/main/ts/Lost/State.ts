interface State {

    elementId: string;
    element?: HTMLElement;
    stateListener?: StateListener;
    eventListeners?: { [_: string]: EventListenerOrEventListenerObject };

    init(stateListener: StateListener): void;

    start();

    stop();

    destroy();

}

function stateDefaultInit(state: State, stateListener: StateListener, eventListeners?: { [_: string]: EventListenerOrEventListenerObject }): void {
    state.element = getElementById(state.elementId);
    state.element.removeAttribute('class');
    state.stateListener = stateListener;
    mapForEach(eventListeners, function (name: string, eventListener: EventListenerOrEventListenerObject) {
        w.addEventListener(name, eventListener, <any>{ passive: false });
    });
    state.eventListeners = eventListeners;
}

function stateDefaultDestroy() {
    let state: State = this;
    state.element.setAttribute('class', 'h');
    mapForEach(state.eventListeners, function (name: string, eventListener: EventListenerOrEventListenerObject) {
        w.removeEventListener(name, eventListener);
    });
}

