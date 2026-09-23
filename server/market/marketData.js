require("dotenv").config();

const crypto = require("crypto");

const WEEX_BASE_URL = "https://api-contract.weex.com";

async function publicRequest(path) {
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

async function privateRequest(method, path, body = "") {
  const apiKey = process.env.WEEX_API_KEY;
  const secretKey = process.env.WEEX_API_SECRET;
  const passphrase = process.env.WEEX_API_PASSPHRASE;

  if (!apiKey || !secretKey || !passphrase) {
    throw new Error("WEEX API credentials are missing from .env");
  }

  const timestamp = Date.now().toString();
  const upperMethod = method.toUpperCase();

  const prehash =
    timestamp +
    upperMethod +
    path +
    body;

  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(prehash)
    .digest("base64");

  const response = await fetch(`${WEEX_BASE_URL}${path}`, {
    method: upperMethod,
    headers: {
      "Content-Type": "application/json",
      "ACCESS-KEY": apiKey,
      "ACCESS-SIGN": signature,
      "ACCESS-TIMESTAMP": timestamp,
      "ACCESS-PASSPHRASE": passphrase,
    },
    body: body || undefined,
  });

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

async function getTradingSymbols() {
  return publicRequest("/capi/v3/market/apiTradingSymbols");
}

async function getExchangeInfo(symbol = "") {
  const query = symbol
    ? `?symbol=${encodeURIComponent(symbol)}`
    : "";

  return publicRequest(`/capi/v3/market/exchangeInfo${query}`);
}

async function getTicker(symbol) {
  return publicRequest(
    `/capi/v3/market/ticker/bookTicker?symbol=${encodeURIComponent(symbol)}`
  );
}

async function getKlines(symbol, interval = "15m", limit = 100) {
  const query = new URLSearchParams({
    symbol,
    interval,
    limit: String(limit),
  });

  return publicRequest(`/capi/v3/market/klines?${query.toString()}`);
}

async function getAccountBalance() {
  return privateRequest(
    "GET",
    "/capi/v3/account/balance"
  );
}

module.exports = {
  getTradingSymbols,
  getExchangeInfo,
  getTicker,
  getKlines,
  getAccountBalance,
};