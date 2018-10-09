/* eslint-env browser */
function write(id, text) {
  document.getElementById(id).innerText = text;
}

function list(id, arr, map) {
  const ul = document.getElementById(id);
  arr.map(map).map(t => {
    const p = document.createElement('p');
    p.innerText = t;
    return p;
  }).forEach(elm => ul.appendChild(elm));
}

const s = window.location.search;

const stock = s.slice(s.indexOf('stock=') + 6, s.includes('&') ? s.indexOf('&', s.indexOf('stock=')) : undefined);

fetch(`/api/stock/${stock}?chart=true&news=true`).then(res => res.json()).then(stock => {
  document.title = `${stock.company.companyName} (${stock.ticker})`;
});
