export const promiseObjectAll = async obj => {
  const keys = Reflect.ownKeys(obj);
  const ary = await Promise.all(keys.map(key => obj[key]));
  return ary.reduce(
    (result, value, index) => Object.assign(result, { [keys[index]]: value }),
    {},
  );
};
export const handleError = (res, err) => {
  console.error(err);
  if (err.statusCode) {
    return res.status(err.statusCode).send(err.statusText || "External server error");
  }
  return res.status(500).send(`Internal server error: ${JSON.stringify(err)}`);
};
export const errorWrapper = str => ({
  error: str,
});
