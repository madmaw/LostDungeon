class State<ElementType extends HTMLElement> {

    protected element: ElementType;
    protected stateListener: StateListener;

    constructor(private elementId: string) {

    }

    init(stateListener: StateListener): void {
        this.element = <ElementType>document.getElementById(this.elementId);
        this.element.removeAttribute('class');
        this.stateListener = stateListener;
    }

    start(): void {

    }

    stop(): void {
        
    }

    destroy(): void {
        this.element.setAttribute('class', 'h');
    }
}