const WEEX_BASE_URL = "https://api-contract.weex.com";

class WeexExecution {
  constructor(config = {}) {
    this.baseUrl =
      config.baseUrl || WEEX_BASE_URL;
  }

  async request(path, options = {}) {
    const response = await fetch(
      `${this.baseUrl}${path}`,
      {
        method: options.method || "GET",
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
        body: options.body
          ? JSON.stringify(options.body)
          : undefined,
      }
    );

    const text = await response.text();

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
        "WEEX returned invalid JSON"
      );
    }

    return data;
  }

  async getTicker(symbol) {
    const normalizedSymbol =
      String(symbol)
        .trim()
        .toUpperCase();

    if (!normalizedSymbol) {
      throw new Error(
        "Ticker requires a symbol"
      );
    }

    return this.request(
      `/capi/v3/market/ticker/bookTicker?symbol=${encodeURIComponent(
        normalizedSymbol
      )}`
    );
  }

  async getOrderBook(
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

    return this.request(
      `/capi/v3/market/depth?symbol=${encodeURIComponent(
        normalizedSymbol
      )}&limit=${limit}`
    );
  }

  /*
   * ------------------------------------------------------------
   * EXECUTION PLACEHOLDER
   * ------------------------------------------------------------
   *
   * The actual signed WEEX order request is intentionally kept
   * separate from market-data requests.
   *
   * We will add:
   *
   * - API key
   * - timestamp
   * - signature
   * - margin mode
   * - leverage
   * - quantity calculation
   * - order type
   * - reduceOnly
   * - position side
   *
   * after the Advanced Bot execution flow is confirmed.
   */

  async openPosition({
    symbol,
    direction,
    quantity,
  }) {
    const normalizedSymbol =
      String(symbol)
        .trim()
        .toUpperCase();

    const normalizedDirection =
      String(direction)
        .trim()
        .toUpperCase();

    if (!normalizedSymbol) {
      throw new Error(
        "Open position requires a symbol"
      );
    }

    if (
      normalizedDirection !== "LONG" &&
      normalizedDirection !== "SHORT"
    ) {
      throw new Error(
        "Open position direction must be LONG or SHORT"
      );
    }

    const numericQuantity =
      Number(quantity);

    if (
      !Number.isFinite(numericQuantity) ||
      numericQuantity <= 0
    ) {
      throw new Error(
        "Open position requires a valid quantity"
      );
    }

    console.log(
      `[Execution] OPEN ${normalizedDirection} ${normalizedSymbol} quantity=${numericQuantity}`
    );

    /*
     * REAL WEEX ORDER WILL BE CONNECTED HERE.
     */

    return {
      success: false,
      simulated: true,
      executed: false,

      symbol: normalizedSymbol,
      direction: normalizedDirection,
      quantity: numericQuantity,

      reason:
        "WEEX order execution is not connected yet",
    };
  }

  async closePosition({
    symbol,
    direction,
    quantity,
  }) {
    const normalizedSymbol =
      String(symbol)
        .trim()
        .toUpperCase();

    const normalizedDirection =
      String(direction)
        .trim()
        .toUpperCase();

    const numericQuantity =
      Number(quantity);

    if (!normalizedSymbol) {
      throw new Error(
        "Close position requires a symbol"
      );
    }

    if (
      normalizedDirection !== "LONG" &&
      normalizedDirection !== "SHORT"
    ) {
      throw new Error(
        "Close position direction must be LONG or SHORT"
      );
    }

    if (
      !Number.isFinite(numericQuantity) ||
      numericQuantity <= 0
    ) {
      throw new Error(
        "Close position requires a valid quantity"
      );
    }

    console.log(
      `[Execution] CLOSE ${normalizedDirection} ${normalizedSymbol} quantity=${numericQuantity}`
    );

    /*
     * REAL REDUCE-ONLY WEEX ORDER WILL BE CONNECTED HERE.
     */

    return {
      success: false,
      simulated: true,
      executed: false,

      symbol: normalizedSymbol,
      direction: normalizedDirection,
      quantity: numericQuantity,

      reason:
        "WEEX close execution is not connected yet",
    };
  }
}

module.exports = WeexExecution;