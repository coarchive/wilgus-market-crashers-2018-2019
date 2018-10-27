/* eslint-env browser */
import {
  crel, crdf, geti, link
} from '../dom';

const linkStock = ticker => link(`/stock.html?stock=${ticker}`, ticker);
const formatMoney = m => Math.round(m * 100) / 100;
const welcome_e = geti('welcome');
const money_e = geti('money');
const stocks_e = geti('stocks');
const history_e = geti('history');
const ppBuy = ['Bought', 'Spent'];
const ppSell = ['Sold', 'Made'];
fetch('/api/user')
  .then(res => res.json())
  .then(user => {
    // Display some basic info
    welcome_e.innerText = `Welcome to the market, ${user.name}!`;
    money_e.innerText = `You have $${formatMoney(user.money)}.`;
    history_e.innerHTML = '';
    const historyFragment = crdf();
    console.log(user);
    user.history.reverse().forEach(entry => {
      const {
        amount, loan, onMargin, price, ticker, type
      } = entry;
      const pastParticiples = type === 'buy' ? ppBuy : ppSell;
      const stock = linkStock(ticker);
      const how = onMargin ? 'on margin' : 'with cash';
      const total = amount * price;
      const li = crel('li');
      // I could have used String.prototype.link but I'm not
      let inhtml = `${pastParticiples[0]} ${amount} shares in ${stock} ${how} at $${price} each. `;
      inhtml += `${pastParticiples[1]} $${total}`;
      const lone = formatMoney(loan);
      if (onMargin && type === 'sell') {
        inhtml += `, paid off the loan with $${lone}`;
      }
      inhtml += '.';
      li.innerHTML = inhtml;
      historyFragment.appendChild(li);
    });
    history_e.appendChild(historyFragment);

    stocks_e.innerHTML = '';
    const stocksFragment = crdf();
    const proms = user.stocks.map(stock => {
      const { ticker } = stock;
      return fetch(`api/stock/${ticker}`)
        .then(res => res.json())
        .then(stobj => {
          const { amount, price } = stock;
          console.log(stobj);
          const { companyName } = stobj.company;
          const link = linkStock(ticker);
          const li = crel('li');
          li.innerHTML = `${amount} shares of ${link} (${companyName}) at $${price} each`;
          stocksFragment.appendChild(li);
        });
    });
    Promise.all(proms).then(() => stocks_e.appendChild(stocksFragment));
  }).then(() => console.log('Fetched all data!'));
