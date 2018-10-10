/* eslint-env browser */
import Chart from 'chart.js';

function write(id, text) {
  document.getElementById(id).innerText = text;
}

const s = window.location.search;

const stock = s.slice(s.indexOf('stock=') + 6, s.includes('&') ? s.indexOf('&', s.indexOf('stock=')) : undefined);

fetch(`/api/stock/${stock}?chart=true`)
  .then(res => res.json())
  .then(stock => {
    document.title = `${stock.company.companyName} (${stock.company.symbol})`;
    write('stock', document.title);
    write('price', `$${stock.price}`);
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
  });
