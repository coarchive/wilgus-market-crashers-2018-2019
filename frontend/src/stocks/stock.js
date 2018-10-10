/* eslint-env browser */
import Chart from 'chart.js';

function write(id, text) {
  document.getElementById(id).innerText = text;
}

const s = window.location.search;

const stock = s.slice(s.indexOf('stock=') + 6, s.includes('&') ? s.indexOf('&', s.indexOf('stock=')) : undefined);

Promise.all([fetch(`/api/stock/${stock}?chart=true`), fetch('/api/user')])
  .then(([res1, res2]) => Promise.all([res1.json(), res2.json()]))
  .then(([stock, user]) => {
    document.title = `${stock.company.companyName} (${stock.company.symbol})`;
    write('stock', `${document.title} - $${stock.price}`);
    const ctx = document.getElementById('chart').getContext('2d');
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: stock.chart.map(c => c.date),
        datasets: [{
          label: stock.company.symbol,
          borderColor: '#0a0',
          data: stock.chart.map(c => c.close)
        }]
      },
      options: {
        responsive: false,
        title: {
          display: true,
          text: 'Value over past Month'
        },
        tooltips: {
          mode: 'index',
          intersect: false
        },
        hover: {
          mode: 'nearest',
          intersect: true
        },
        scales: {
          xAxes: [{
            display: true,
            scaleLabel: {
              display: true,
              labelString: 'Day'
            }
          }],
          yAxes: [{
            display: true,
            scaleLabel: {
              display: true,
              labelString: 'Value'
            }
          }]
        }
      }
    });
    chart.render({
      duration: 800,
      lazy: false,
      easing: 'easeOutBounce'
    });
    document.getElementById('add').onclick = () => {
      const newStock = prompt('What stock to add?'); // TODO: Something better
      fetch(`/api/stock/${newStock}?chart=true`)
        .then(res => res.json())
        .then(newStock => {
          const newDataset = {
            label: newStock.company.symbol,
            borderColor: '#a00',
            data: newStock.chart.map(c => c.close)
          };
          chart.config.data.datasets.push(newDataset);
          chart.update();
        });
    };
    const feedback = document.getElementById('feedback');
    const type = document.getElementById('type');
    const howMuch = document.getElementById('much');
    const go = document.getElementById('go');
    const ticker = stock.company.symbol;
    const ownedP = document.getElementById('owned');
    function recalcFeedback() {
      if (type.value === 'buy') {
        const cost = howMuch.value * stock.price;
        feedback.innerText = `This will cost you $${cost}. You will ${cost < user.money ? 'not ' : ''}need a loan.`;
        go.disabled = false;
      } else {
        const owned = user.stocks.filter(s => s.ticker === ticker)[0];
        if (owned == null) {
          feedback.innerText = 'Can\'t sell something you don\'t own!';
          go.disabled = true;
        } else if (howMuch.value > owned.amount) {
          feedback.innerText = 'Can\'t sell more than owned.';
          go.disabled = true;
        } else {
          const earned = howMuch.value * stock.price;
          feedback.innerTest = `This will give you $${earned}.${owned.onMargin
            ? ` You will need to pay off the loan with $${howMuch.value * owned.price}.`
            : ''}`;
          go.disabled = true;
        }
      }
    }
    if (user.error === 'Unauthorized') {
      document.getElementById('transact').style.display = 'none';
      ownedP.innerText = '';
    } else {
      const owned = user.stocks.filter(s => s.ticker === ticker)[0];
      type.onchange = howMuch.onchange = recalcFeedback;
      if (owned == null) {
        ownedP.innerText = '';
      } else {
        ownedP.innerText = `You own ${owned.amount} shares in ${ticker}.`;
      }
      go.onclick = () => {
        fetch(`/api/${type.value}/${ticker}?amount=${howMuch.value}`)
          .then(res => res.json())
          .then(resp => {
            if (resp.error) {
              alert(`ERROR: ${resp.error}`); // TODO: something better
            } else {
              window.location.reload();
            }
          }).catch(err => alert(`ERROR: ${err.toString()}`)); // TODO: something better
      };
    }
  });
