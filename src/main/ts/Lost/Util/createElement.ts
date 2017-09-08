function createElement(name: string, attributes?: {[_:string]: string }) {
    let e = doc.createElement(name);
    mapForEach(attributes, function (key: string, value: string) {
        e.setAttribute(key, value);
    });
    return e;
}
