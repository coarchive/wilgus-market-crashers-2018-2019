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

fetch('/api/user').then(res => res.json()).then(user => {
  write('welcome', `Welcome to the market, ${user.name}!`);
  write('money', `You have $${user.money}.`);
  list(
    'stocks',
    user.stocks,
    stock => `${stock.amount} shares in ${stock.ticker} ${stock.onMargin
      ? 'on margin'
      : 'with cash'} at $${stock.price} each.`
  );
  list('history',
    user.history,
    entry => `${entry.type === 'buy' ? 'Bought' : 'Sold'} ${entry.amount} shares in ${entry.ticker} ${entry.onMargin
      ? 'on margin'
      : 'with cash'} at $${entry.price} each. `);
});
