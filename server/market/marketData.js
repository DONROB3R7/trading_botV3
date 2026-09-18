const WEEX_BASE_URL = "https://api-contract.weex.com";

async function request(path) {
  const response = await fetch(`${WEEX_BASE_URL}${path}`);

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`WEEX HTTP ${response.status}: ${text}`);
  }

  return JSON.parse(text);
}

async function getTradingSymbols() {
  return request("/capi/v3/market/apiTradingSymbols");
}

async function getExchangeInfo(symbol = "") {
  const query = symbol
    ? `?symbol=${encodeURIComponent(symbol)}`
    : "";

  return request(`/capi/v3/market/exchangeInfo${query}`);
}

async function getTicker(symbol) {
  return request(
    `/capi/v3/market/ticker/bookTicker?symbol=${encodeURIComponent(symbol)}`
  );
}

module.exports = {
  getTradingSymbols,
  getExchangeInfo,
  getTicker,
};