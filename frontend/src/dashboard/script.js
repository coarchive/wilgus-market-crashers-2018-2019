/* eslint-env browser */
function write(id, text) {
  document.getElementById(id).innerHTML = text;
}

function link(href, text) {
  return `<a href=${href}>${text}</a>`;
}

function list(id, arr, map) {
  const ul = document.getElementById(id);
  arr.map(map).map(t => {
    const p = document.createElement('p');
    p.innerHTML = t;
    return p;
  }).forEach(elm => ul.appendChild(elm));
}

function formatMoney(money) {
  return Math.round(money * 100) / 100;
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
    stock => `${stock.amount} shares in ${link(
      `/stock.html?stock=${stock.ticker}`,
      `${stockInfos[stock.ticker]
        .company
        .companyName} (${stock.ticker})`
    )} ${stock.onMargin
      ? 'on margin'
      : 'with cash'} at $${stock.price} each. Currently worth $${formatMoney(
      stock.amount * stockInfos[stock.ticker].price
    )}`
  ));
}

fetch('/api/user').then(res => res.json()).then(user => {
  write('welcome', `Welcome to the market, ${user.name}!`);
  write('money', `You have $${formatMoney(user.money)}.`);
  list('history',
    user.history.reverse(),
    entry => `${entry.type === 'buy'
      ? 'Bought'
      : 'Sold'} ${entry.amount} shares in ${link(
      `/stock.html?stock=${entry.ticker}`,
      entry.ticker
    )} ${entry.onMargin
      ? 'on margin'
      : 'with cash'} at $${entry.price} each. ${entry.type === 'buy'
      ? 'Spent'
      : 'Earned'} $${formatMoney(entry.amount * entry.price)}${entry.onMargin && entry.type === 'sell'
      ? `, paid off the loan with $${formatMoney(entry.loan)}.`
      : '.'}`);
  return handleStocks(user.stocks);
}).then(() => console.log('DONE!')); // eslint-disable-line no-console
