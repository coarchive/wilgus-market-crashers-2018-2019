export const crel = document.createElement.bind(document);
export const crdf = () => document.createDocumentFragment();
export const geti = document.getElementById.bind(document);
export const link = (href, text) => `<a href=${href}>${text}</a>`;
export function write(id, text) {
  document.getElementById(id).innerHTML = text;
}
