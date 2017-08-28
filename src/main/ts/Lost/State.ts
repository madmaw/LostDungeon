class State<ElementType extends HTMLElement> {

    protected element: ElementType;
    protected stateListener: StateListener;
    private eventListeners: { [_: string]: EventListenerOrEventListenerObject };

    constructor(private elementId: string) {

    }

    init(stateListener: StateListener, eventListeners?: { [_: string]: EventListenerOrEventListenerObject }): void {
        this.element = <ElementType>document.getElementById(this.elementId);
        this.element.removeAttribute('class');
        this.stateListener = stateListener;
        for (let name in eventListeners) {
            let eventListener = eventListeners[name];
            document.addEventListener(name, eventListener, <any>{ passive: false });
        }
        this.eventListeners = eventListeners;
    }

    start(): void {

    }

    stop(): void {
        
    }

    destroy(): void {
        this.element.setAttribute('class', 'h');
        for (let name in this.eventListeners) {
            let eventListener = this.eventListeners[name];
            document.removeEventListener(name, eventListener);
        }
    }
}
