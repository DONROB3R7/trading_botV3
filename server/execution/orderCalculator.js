const {
  getExchangeInfo,
  getTicker,
} = require("../market/marketData");

// ============================================================
// FIND SYMBOL DATA
// ============================================================

function findSymbolData(value, symbol) {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findSymbolData(
        item,
        symbol
      );

      if (found) {
        return found;
      }
    }

    return null;
  }

  if (typeof value !== "object") {
    return null;
  }

  if (
    value.symbol &&
    String(value.symbol)
      .trim()
      .toUpperCase() === symbol
  ) {
    return value;
  }

  for (const child of Object.values(value)) {
    const found = findSymbolData(
      child,
      symbol
    );

    if (found) {
      return found;
    }
  }

  return null;
}

// ============================================================
// FIND TICKER DATA
// ============================================================

function findTickerData(value, symbol) {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findTickerData(
        item,
        symbol
      );

      if (found) {
        return found;
      }
    }

    return null;
  }

  if (typeof value !== "object") {
    return null;
  }

  if (
    value.symbol &&
    String(value.symbol)
      .trim()
      .toUpperCase() === symbol
  ) {
    return value;
  }

  for (const child of Object.values(value)) {
    const found = findTickerData(
      child,
      symbol
    );

    if (found) {
      return found;
    }
  }

  return null;
}

// ============================================================
// SAFE NUMBER
// ============================================================

function toNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

// ============================================================
// CALCULATE ORDER
// ============================================================

async function calculateOrder(
  symbol,
  marginUSDT,
  leverage
) {
  // ==========================================================
  // BASIC INPUT
  // ==========================================================

  if (!symbol) {
    throw new Error(
      "Symbol is required"
    );
  }

  const normalizedSymbol =
    String(symbol)
      .trim()
      .toUpperCase();

  const margin =
    Number(marginUSDT);

  const lev =
    Number(leverage);

  if (
    !Number.isFinite(margin) ||
    margin <= 0
  ) {
    throw new Error(
      "Margin must be greater than 0"
    );
  }

  if (
    !Number.isFinite(lev) ||
    lev <= 0
  ) {
    throw new Error(
      "Leverage must be greater than 0"
    );
  }

  // ==========================================================
  // GET WEEX MARKET DATA
  // ==========================================================

  const exchangeInfoResponse =
    await getExchangeInfo(
      normalizedSymbol
    );

  const tickerResponse =
    await getTicker(
      normalizedSymbol
    );

  const exchangeInfo =
    findSymbolData(
      exchangeInfoResponse,
      normalizedSymbol
    );

  const ticker =
    findTickerData(
      tickerResponse,
      normalizedSymbol
    );

  if (!exchangeInfo) {
    throw new Error(
      `No exchange information found for ${normalizedSymbol}`
    );
  }

  if (!ticker) {
    throw new Error(
      `No ticker information found for ${normalizedSymbol}`
    );
  }

  // ==========================================================
  // PRICE
  // ==========================================================

  const bidPrice =
    toNumber(
      ticker.bidPrice
    );

  const askPrice =
    toNumber(
      ticker.askPrice
    );

  if (
    !Number.isFinite(bidPrice) ||
    bidPrice <= 0
  ) {
    throw new Error(
      `Invalid bid price for ${normalizedSymbol}`
    );
  }

  if (
    !Number.isFinite(askPrice) ||
    askPrice <= 0
  ) {
    throw new Error(
      `Invalid ask price for ${normalizedSymbol}`
    );
  }

  const currentPrice =
    (
      bidPrice +
      askPrice
    ) / 2;

  if (
    !Number.isFinite(currentPrice) ||
    currentPrice <= 0
  ) {
    throw new Error(
      `Invalid current price for ${normalizedSymbol}`
    );
  }

  // ==========================================================
  // CONTRACT SETTINGS
  // ==========================================================

  const contractVal =
    toNumber(
      exchangeInfo.contractVal
    );

  const minOrderSize =
    toNumber(
      exchangeInfo.minOrderSize
    );

  if (
    !Number.isFinite(contractVal) ||
    contractVal <= 0
  ) {
    throw new Error(
      `Invalid contractVal for ${normalizedSymbol}`
    );
  }

  if (
    !Number.isFinite(minOrderSize) ||
    minOrderSize <= 0
  ) {
    throw new Error(
      `Invalid minOrderSize for ${normalizedSymbol}`
    );
  }

  // ==========================================================
  // TARGET NOTIONAL
  //
  // Example:
  //
  // margin = 0.5
  // leverage = 10
  //
  // target = 5 USDT
  // ==========================================================

  const targetNotional =
    margin * lev;

  // ==========================================================
  // RAW CONTRACT QUANTITY
  // ==========================================================

  const rawContracts =
    targetNotional /
    (
      currentPrice *
      contractVal
    );

  if (
    !Number.isFinite(rawContracts) ||
    rawContracts <= 0
  ) {
    throw new Error(
      `Unable to calculate contracts for ${normalizedSymbol}`
    );
  }

  // ==========================================================
  // ROUND UP TO WEEX MINIMUM
  //
  // IMPORTANT:
  //
  // We keep the exchange minimum.
  // We DO NOT pretend the requested margin was achieved
  // when the minimum order is larger.
  // ==========================================================

  const roundedContracts =
    Math.ceil(
      rawContracts /
      minOrderSize
    ) *
    minOrderSize;

  const contracts =
    Math.max(
      minOrderSize,
      roundedContracts
    );

  if (
    !Number.isFinite(contracts) ||
    contracts <= 0
  ) {
    throw new Error(
      `Invalid calculated contracts for ${normalizedSymbol}`
    );
  }

  // ==========================================================
  // ACTUAL NOTIONAL
  // ==========================================================

  const actualNotional =
    contracts *
    contractVal *
    currentPrice;

  if (
    !Number.isFinite(actualNotional) ||
    actualNotional <= 0
  ) {
    throw new Error(
      `Invalid actual notional for ${normalizedSymbol}`
    );
  }

  // ==========================================================
  // ESTIMATED REQUIRED MARGIN
  // ==========================================================

  const estimatedMargin =
    actualNotional /
    lev;

  if (
    !Number.isFinite(estimatedMargin) ||
    estimatedMargin <= 0
  ) {
    throw new Error(
      `Invalid estimated margin for ${normalizedSymbol}`
    );
  }

  // ==========================================================
  // MINIMUM POSSIBLE ORDER
  // ==========================================================

  const minimumOrderNotional =
    minOrderSize *
    contractVal *
    currentPrice;

  const minimumRequiredMargin =
    minimumOrderNotional /
    lev;

  // ==========================================================
  // MARGIN CHECK
  // ==========================================================

  const marginExceeded =
    estimatedMargin >
    margin;

  const marginDifference =
    estimatedMargin -
    margin;

  const marginRatio =
    estimatedMargin /
    margin;

  // ==========================================================
  // STATUS
  // ==========================================================

  let marginStatus;

  if (marginExceeded) {
    marginStatus =
      "MINIMUM_ORDER_EXCEEDS_CONFIGURED_MARGIN";
  } else {
    marginStatus =
      "WITHIN_CONFIGURED_MARGIN";
  }

  // ==========================================================
  // LOG
  // ==========================================================

  console.log("");

  console.log(
    "============================================================"
  );

  console.log(
    `[OrderCalculator] ${normalizedSymbol}`
  );

  console.log(
    "============================================================"
  );

  console.log(
    `[OrderCalculator] Price=${currentPrice}`
  );

  console.log(
    `[OrderCalculator] Contract Value=${contractVal}`
  );

  console.log(
    `[OrderCalculator] Minimum Order Size=${minOrderSize}`
  );

  console.log(
    `[OrderCalculator] Requested Margin=${margin.toFixed(4)} USDT`
  );

  console.log(
    `[OrderCalculator] Leverage=${lev}x`
  );

  console.log(
    `[OrderCalculator] Target Notional=${targetNotional.toFixed(4)} USDT`
  );

  console.log(
    `[OrderCalculator] Raw Contracts=${rawContracts}`
  );

  console.log(
    `[OrderCalculator] Final Contracts=${contracts}`
  );

  console.log(
    `[OrderCalculator] Actual Notional=${actualNotional.toFixed(4)} USDT`
  );

  console.log(
    `[OrderCalculator] Required Margin=${estimatedMargin.toFixed(4)} USDT`
  );

  if (marginExceeded) {
    console.warn(
      `[OrderCalculator] WARNING: WEEX minimum order requires ${estimatedMargin.toFixed(4)} USDT instead of configured ${margin.toFixed(4)} USDT`
    );
  } else {
    console.log(
      `[OrderCalculator] Margin is within configured limit`
    );
  }

  console.log(
    "============================================================"
  );

  console.log("");

  // ==========================================================
  // RETURN
  // ==========================================================

  return {
    symbol:
      normalizedSymbol,

    // --------------------------------------------------------
    // USER SETTINGS
    // --------------------------------------------------------

    marginUSDT:
      margin,

    leverage:
      lev,

    // --------------------------------------------------------
    // MARKET
    // --------------------------------------------------------

    price:
      currentPrice,

    bidPrice,

    askPrice,

    // --------------------------------------------------------
    // CONTRACT
    // --------------------------------------------------------

    contractVal,

    minOrderSize,

    // --------------------------------------------------------
    // TARGET
    // --------------------------------------------------------

    targetNotional,

    rawContracts,

    // --------------------------------------------------------
    // ACTUAL ORDER
    // --------------------------------------------------------

    contracts,

    actualNotional,

    estimatedMargin,

    // --------------------------------------------------------
    // MINIMUM ORDER
    // --------------------------------------------------------

    minimumOrderNotional,

    minimumRequiredMargin,

    // --------------------------------------------------------
    // MARGIN CHECK
    // --------------------------------------------------------

    marginExceeded,

    marginDifference,

    marginRatio,

    // --------------------------------------------------------
    // STATUS
    // --------------------------------------------------------

    marginStatus,
  };
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  calculateOrder,
};