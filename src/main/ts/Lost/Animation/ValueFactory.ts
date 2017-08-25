interface ValueFactory<T> {
    (p: number, existingValue: T): T;
}
