const WEEX_BASE_URL = "https://api-contract.weex.com";

async function request(path) {
  const response = await fetch(`${WEEX_BASE_URL}${path}`);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`WEEX HTTP ${response.status}: ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`WEEX returned invalid JSON: ${text}`);
  }
}

// ---------------------------------------------------------
// SYMBOLS
// ---------------------------------------------------------

async function getTradingSymbols() {
  return request("/capi/v3/market/apiTradingSymbols");
}

// ---------------------------------------------------------
// EXCHANGE INFO
// ---------------------------------------------------------

async function getExchangeInfo(symbol = "") {
  const query = symbol
    ? `?symbol=${encodeURIComponent(symbol)}`
    : "";

  return request(`/capi/v3/market/exchangeInfo${query}`);
}

// ---------------------------------------------------------
// TICKER
// ---------------------------------------------------------

async function getTicker(symbol) {
  return request(
    `/capi/v3/market/ticker/bookTicker?symbol=${encodeURIComponent(symbol)}`
  );
}

// ---------------------------------------------------------
// KLINES / CANDLES
// ---------------------------------------------------------

async function getKlines(symbol, interval = "15m", limit = 100) {
  const query = new URLSearchParams({
    symbol,
    interval,
    limit: String(limit),
  });

  return request(`/capi/v3/market/klines?${query.toString()}`);
}

module.exports = {
  getTradingSymbols,
  getExchangeInfo,
  getTicker,
  getKlines,
};