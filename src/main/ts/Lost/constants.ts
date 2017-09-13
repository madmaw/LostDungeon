let pi = Math.PI;
let pi2 = pi * 2;
let piOn2 = pi / 2;
let nil = null;
let max = Math.max;
let min = Math.min;
let w = window;
let doc = document;
let abs = Math.abs;
let floor = Math.floor;
let ceil = Math.ceil;
let sin = Math.sin;
let cos = Math.cos;
let random = Math.random;
let sqrt = Math.sqrt;
let ls: Storage = w['localStorage'];

// trick closure compiler into not inlining these methods
function getElemById(id: string): HTMLElement {
    return doc.getElementById(id);
}

function setAttrib(e: Element, key: string, value: string) {
    e.setAttribute(key, value);
}
function arrayPush<A>(a: A[], v: A) {
    a.push(v);
}
function arraySplice<A>(a: A[], index: number, deleteCount: number, value?: A) {
    return value != undefined ? a.splice(index, deleteCount, value) : a.splice(index, deleteCount);
}


