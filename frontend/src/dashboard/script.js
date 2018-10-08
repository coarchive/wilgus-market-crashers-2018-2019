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

function handleStocks(stocks) {
  const stockInfos = {};
  const proms = [];
  for (const v of stocks) {
    proms.push(fetch(`/api/stock/${v.ticker}`)
      .then(res => res.json())
      .then(info => { stockInfos[v.ticker] = info; }));
  }
  return Promise.all(proms).then(() => list(
    'stocks',
    stocks,
    stock => `${stock.amount} shares in ${stockInfos[stock.ticker]
      .company
      .companyName} (${stock.ticker}) ${stock.onMargin
      ? 'on margin'
      : 'with cash'} at $${stock.price} each. Worth $${stock.amount * stockInfos[stock.ticker].price}`
  ));
}

fetch('/api/user').then(res => res.json()).then(user => {
  write('welcome', `Welcome to the market, ${user.name}!`);
  write('money', `You have $${user.money}.`);
  list('history',
    user.history,
    entry => `${entry.type === 'buy'
      ? 'Bought'
      : 'Sold'} ${entry.amount} shares in ${entry.ticker} ${entry.onMargin
      ? 'on margin'
      : 'with cash'} at $${entry.price} each. ${entry.type === 'buy'
      ? 'Spent'
      : 'Earned'} $${entry.amount * entry.price}`);
  return handleStocks(user.stocks);
}).then(() => console.log('DONE!'));
