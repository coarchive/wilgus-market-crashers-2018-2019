/* eslint-env browser */

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
          const ul = document.getElementById('stocks');
          res.stocks.forEach((stock, i) => {
            const a = document.createElement('a');
            a.href = `/stock.html?stock=${stock.symbol}`;
            a.innerText = `${stock.name} (${stock.symbol}) - $${reses[i].price}`;
            ul.appendChild(a);
            ul.appendChild(document.createElement('br'));
            ul.appendChild(document.createElement('br'));
          });
        });
      })
      .then(() => console.log('DONE!'));
  };
};
