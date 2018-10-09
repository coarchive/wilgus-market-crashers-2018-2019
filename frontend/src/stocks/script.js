/* eslint-env browser */

function list(id, arr, map) {
  const ul = document.getElementById(id);
  arr.map(map).map(t => {
    const p = document.createElement('p');
    p.innerText = t;
    return p;
  }).forEach(elm => ul.appendChild(elm));
}

window.onload = () => {
  const search = document.getElementById('search');
  const button = document.getElementById('doSearch');
  button.onclick = () => {
    const stocks = document.getElementById('stocks');
    [...stocks.children].forEach(child => stocks.removeChild(child));
    fetch(`/api/stocks/search/${search.value}`)
      .then(res => res.json())
      .then(res => {
        const proms = res.stocks.map(stock => fetch(`/api/stock/${stock.symbol}`).then(res => res.json()));
        Promise.all(proms).then(reses => {
          list(
            'stocks',
            res.stocks,
            (stock, i, _, stockData = reses[i]) => `${stock.name} (${stock.symbol}) - $${stockData.price}`
          );
        });
      })
      .then(() => console.log('DONE!'));
  };
};
