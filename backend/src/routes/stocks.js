import chalk from "chalk";
import fetch from "node-fetch";
import { IEXClient } from "iex-api";
import { users } from "../database";
import { existsSync, writeFileSync, promises } from "fs";
import { errorWrapper, handleError, promiseObjectAll } from "../utils";
import { Stock } from "../../../shared/classes";

new Stock();
const { readFile } = promises;
const symbolsURL = "https://api.iextrading.com/1.0/ref-data/symbols";
const IEX_symbol_cache = "symbols.json";
const IEX_symbol_to_array = ({
  symbol, name, type,
}) => [symbol, name, type];
const resUndefined = Promise.resolve(undefined);

(async () => {
  if (!existsSync(IEX_symbol_cache)) {
    // check if we've cached the symbols
    console.log(chalk.yellow`Downloading IEXSymbols!`);
    const symbolArray = await fetch(symbolsURL).then(res => res.json());
    const convertedSymbols = symbolArray.map(IEX_symbol_to_array);
    writeFileSync(IEX_symbol_cache, JSON.stringify(convertedSymbols));
    console.log(chalk.yellow`Finished downloading IEXSymbols!`);
  } else {
    console.log(chalk.bgGreen`IEXSymbols already downloaded!`);
  }
})();

const iex = new IEXClient(fetch);

export async function get(req, res) {
  const { ticker, includeChart, includeNews } = req.params;
  if (!ticker || ticker !== ticker.toString()) {
    res.status(400).send(errorWrapper("Invalid or missing ticker"));
    return;
  }
  try {
    const stock = await promiseObjectAll({
      company: iex.stockCompany(ticker),
      price: iex.stockPrice(ticker),
      chart: includeChart ? iex.stockChart(ticker, "1m") : resUndefined,
      news: includeNews ? iex.stockNews(ticker, 2) : resUndefined,
    });
    res.send(stock);
  } catch (err) {
    handleError(res, err);
  }
}

export async function buy(req, res) {
  const { ticker } = req.params;
  const amount = req.query.amount == null ? 1 : Number(req.query.amount);
  if (!Number.isInteger(amount)) {
    res.status(400).send(errorWrapper("Amount must be an integer"));
    return;
  }
  const stocks = req.user.stocks.filter(stock => stock.ticker === ticker);
  if (stocks.length > 1) {
    throw new Error("ERROR: Database could not find the selected ticker");
  }
  let stock = stocks.length === 0 ? null : stocks[0];
  try {
    const price = await iex.stockPrice(ticker);
    if (price === "Unknown symbol") {
      res.status(400).send(errorWrapper(price));
      return;
    }
    const onMargin = req.user.money < price * amount;
    req.user.history.push({
      type: "buy",
      ticker,
      amount,
      price,
      onMargin,
    });
    if (stock) {
      if (onMargin) {
        res.status(400).send(errorWrapper("Not enough money")); // TODO: Buy the same stock on and off margin
        return;
      }
      stock.amount += amount;
      req.user.money -= price * amount;
    } else {
      stock = {
        ticker,
        price,
        amount,
        onMargin,
      };
      req.user.stocks.push(stock);
    }
    await users.put(req.user);
    res.send(stock);
  } catch (err) {
    handleError(res, err);
  }
}

export async function sell(req, res) {
  const { ticker } = req.params;
  const amount = req.query.amount == null ? 1 : +req.query.amount;
  if (!Number.isInteger(amount)) {
    res.status(400).send(errorWrapper("Amount must be an integer"));
  }
  let idx;
  const stocks = req.user.stocks.filter((stock, i) => {
    if (stock.ticker === ticker) {
      idx = i;
      return true;
    }
    return false;
  });
  if (stocks.length === 0) {
    req.status(400).send(errorWrapper(`User doesn't have stock "${ticker}"`));
  }
  if (stocks.length !== 1) {
    throw new Error("ERROR: Database Corrupt");
  }
  const stock = stocks[0];
  if (stock.amount < amount) {
    res.status(400).send(errorWrapper("Cannot sell more than owned"));
  }
  try {
    const price = iex.stockPrice(ticker);
    req.user.history.push({
      type: "sell",
      ticker,
      amount,
      price,
      onMargin: stock.onMargin,
      loan: stock.onMargin ? stock.price * amount : undefined,
    });
    stock.amount -= amount;
    req.user.money += price * amount;
    if (stock.onMargin) {
      req.user.money -= stock.price * amount;
    }
    if (stock.amount === 0) {
      req.user.stocks.splice(idx, 1);
    }
    await users.put(req.user);
    res.send({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
}

export async function search(req, res) {
  const { query } = req.params;
  if (!query) {
    res.status(400).send(errorWrapper("Must provide a query"));
  }
  try {
    const result = await readFile(IEX_symbol_cache);
    const stocks = ["foobar"];
    res.send({ stocks, query });
  } catch (err) {
    handleError(res, err);
  }
}

export async function symbols(req, res) {
  res.send(JSON.parse(await readFile(IEX_symbol_cache, "utf8")));
}
