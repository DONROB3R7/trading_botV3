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
      const found =
        findSymbolData(
          item,
          symbol
        );

      if (found) {
        return found;
      }
    }

    return null;
  }

  if (
    typeof value !==
    "object"
  ) {
    return null;
  }

  if (
    value.symbol &&
    String(
      value.symbol
    ).toUpperCase() === symbol
  ) {
    return value;
  }

  for (
    const child of
    Object.values(value)
  ) {
    const found =
      findSymbolData(
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
      const found =
        findTickerData(
          item,
          symbol
        );

      if (found) {
        return found;
      }
    }

    return null;
  }

  if (
    typeof value !==
    "object"
  ) {
    return null;
  }

  if (
    value.symbol &&
    String(
      value.symbol
    ).toUpperCase() === symbol
  ) {
    return value;
  }

  for (
    const child of
    Object.values(value)
  ) {
    const found =
      findTickerData(
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
// CALCULATE ORDER
// ============================================================

async function calculateOrder(
  symbol,
  marginUSDT,
  leverage
) {
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
    Number(
      marginUSDT
    );

  const lev =
    Number(
      leverage
    );

  if (
    !Number.isFinite(
      margin
    ) ||
    margin <= 0
  ) {
    throw new Error(
      "Margin must be greater than 0"
    );
  }

  if (
    !Number.isFinite(
      lev
    ) ||
    lev <= 0
  ) {
    throw new Error(
      "Leverage must be greater than 0"
    );
  }

  // ==========================================================
  // MARKET DATA
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
    Number(
      ticker.bidPrice
    );

  const askPrice =
    Number(
      ticker.askPrice
    );

  if (
    !Number.isFinite(
      bidPrice
    ) ||
    !Number.isFinite(
      askPrice
    )
  ) {
    throw new Error(
      `Invalid ticker price for ${normalizedSymbol}`
    );
  }

  const currentPrice =
    (bidPrice + askPrice) /
    2;

  // ==========================================================
  // CONTRACT SETTINGS
  // ==========================================================

  const contractVal =
    Number(
      exchangeInfo.contractVal
    );

  const minOrderSize =
    Number(
      exchangeInfo.minOrderSize
    );

  if (
    !Number.isFinite(
      contractVal
    ) ||
    contractVal <= 0
  ) {
    throw new Error(
      `Invalid contractVal for ${normalizedSymbol}`
    );
  }

  if (
    !Number.isFinite(
      minOrderSize
    ) ||
    minOrderSize <= 0
  ) {
    throw new Error(
      `Invalid minOrderSize for ${normalizedSymbol}`
    );
  }

  // ==========================================================
  // TARGET NOTIONAL
  // ==========================================================

  const targetNotional =
    margin * lev;

  // ==========================================================
  // RAW CONTRACTS
  // ==========================================================

  const rawContracts =
    targetNotional /
    (
      currentPrice *
      contractVal
    );

  // ==========================================================
  // EXCHANGE-MINIMUM CONTRACTS
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

  // ==========================================================
  // ACTUAL ORDER
  // ==========================================================

  const actualNotional =
    contracts *
    contractVal *
    currentPrice;

  const estimatedMargin =
    actualNotional /
    lev;

  // ==========================================================
  // MARGIN TRANSPARENCY
  // ==========================================================

  const marginExceeded =
    estimatedMargin >
    margin;

  const marginDifference =
    estimatedMargin -
    margin;

  const minimumRequiredMargin =
    (
      minOrderSize *
      contractVal *
      currentPrice
    ) /
    lev;

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
    // ACTUAL
    // --------------------------------------------------------

    contracts,

    actualNotional,

    estimatedMargin,

    // --------------------------------------------------------
    // MARGIN CHECK
    // --------------------------------------------------------

    marginExceeded,

    marginDifference,

    minimumRequiredMargin,

    // --------------------------------------------------------
    // HUMAN-READABLE STATUS
    // --------------------------------------------------------

    marginStatus:
      marginExceeded
        ? "MINIMUM_ORDER_EXCEEDS_CONFIGURED_MARGIN"
        : "WITHIN_CONFIGURED_MARGIN",
  };
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  calculateOrder,
};

