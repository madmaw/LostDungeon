function effectSetPropertyFactory<T>(target: any, propertyName: string, valueFactory: ValueFactory<T>): Effect {
    return function (p: number) {
        let value: T = target[propertyName];
        value = valueFactory(p, value);
        target[propertyName] = value;
    }
}
