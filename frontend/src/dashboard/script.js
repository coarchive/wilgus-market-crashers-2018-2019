import {
  clear, crel, crdf, geti, link,
} from "../dom";

const linkStock = ticker => link(`/stock.html?stock=${ticker}`, ticker);
const formatMoney = m => Math.round(m * 100) / 100;
const welcome_e = geti("welcome");
const first_name_e = geti("first-name");
const last_name_e = geti("last-name");
const money_e = geti("money");
const stocks_e = geti("stocks");
const history_e = geti("history");
const ppBuy = ["Bought", "Spent"];
const ppSell = ["Sold", "Made"];
fetch("/api/user")
  .then(res => res.json())
  .then(user => {
    // Display some basic info
    const n = user.name.split(" ");
    console.log(n);
    if (n.length === 2) {
      [first_name_e.innerText, last_name_e.innerText] = n;
    }
    money_e.innerText = `You have $${formatMoney(user.money)}.`;
    clear(history_e);
    const historyFragment = crdf();
    user.history.reverse().forEach(entry => {
      const {
        amount, loan, onMargin, price, ticker, type,
      } = entry;
      const pastParticiples = type === "buy" ? ppBuy : ppSell;
      const stock = linkStock(ticker);
      const how = onMargin ? "on margin" : "with cash";
      const total = amount * price;
      const li = crel("li");
      // I could have used String.prototype.link but I'm not
      let inhtml = `${pastParticiples[0]} ${amount} shares in ${stock} ${how} at $${price} each. `;
      inhtml += `${pastParticiples[1]} $${total}`;
      const lone = formatMoney(loan);
      if (onMargin && type === "sell") {
        inhtml += `, paid off the loan with $${lone}`;
      }
      inhtml += ".";
      li.innerHTML = inhtml;
      historyFragment.appendChild(li);
    });
    history_e.appendChild(historyFragment);

    clear(stocks_e);
    const stocksFragment = crdf();
    const proms = user.stocks.map(stock => {
      const { ticker } = stock;
      return fetch(`api/stock/${ticker}`)
        .then(res => res.json())
        .then(stobj => {
          const { amount, price } = stock;
          const { companyName } = stobj.company;
          const link = linkStock(ticker);
          const li = crel("li");
          li.innerHTML = `${amount} shares of ${link} (${companyName}) at $${price} each`;
          stocksFragment.appendChild(li);
        });
    });
    Promise.all(proms).then(() => stocks_e.appendChild(stocksFragment));
  }).then(() => console.log("Fetched all data!"));
