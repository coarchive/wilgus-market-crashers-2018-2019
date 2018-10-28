import {
  clear, crel, crdf, geti, link,
} from '../dom';

const button_e = geti('doSearch');
const search_e = geti('search');
const stocks_e = geti('stocks');

button_e.onclick = () => {
  clear(stocks_e);
  fetch(`/api/stocks/search/${search_e.value}`)
    .then(res => res.json())
    .then(searchRes => {
      console.log(searchRes);
      searchRes.stocks.forEach(stock => {
        console.log(stock);
        const { symbol } = stock;
        fetch(`/api/stock/${stock.symbol}`)
          .then(res => res.json())
          .then(stockData => {
            console.log(stockData);
            const { companyName } = stockData.company;
            const fragment = crdf();
            const a = crel('a');
            a.href = `/stock.html?stock=${symbol}`;
            a.innerText = `${companyName} (${symbol})`;
            fragment.appendChild(a);
            fragment.appendChild(crel('br'));
            fragment.appendChild(crel('br'));
            stocks_e.appendChild(fragment);
          });
      });
    })
    .then(() => console.log('DONE!'));
};
