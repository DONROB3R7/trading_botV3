const WEEX_BASE_URL =
  "https://api-contract.weex.com";

// =========================================================
// GET ORDER BOOK
// =========================================================

async function getOrderBook(
  symbol,
  limit = 200
) {
  const normalizedSymbol =
    String(symbol)
      .trim()
      .toUpperCase();

  if (!normalizedSymbol) {
    throw new Error(
      "Order book requires a symbol"
    );
  }

  if (
    limit !== 15 &&
    limit !== 200
  ) {
    throw new Error(
      "WEEX order book limit must be 15 or 200"
    );
  }

  const query =
    new URLSearchParams({
      symbol: normalizedSymbol,
      limit: String(limit),
    });

  const response =
    await fetch(
      `${WEEX_BASE_URL}/capi/v3/market/depth?${query.toString()}`
    );

  const text =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `WEEX HTTP ${response.status}: ${text}`
    );
  }

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      "WEEX returned invalid JSON for order book"
    );
  }

  if (
    !data ||
    !Array.isArray(data.bids) ||
    !Array.isArray(data.asks)
  ) {
    throw new Error(
      "WEEX returned invalid order book data"
    );
  }

  return {
    symbol: normalizedSymbol,

    limit,

    bids: data.bids,

    asks: data.asks,

    lastUpdateId:
      data.lastUpdateId ?? null,

    receivedAt:
      new Date().toISOString(),
  };
}

module.exports = {
  getOrderBook,
};