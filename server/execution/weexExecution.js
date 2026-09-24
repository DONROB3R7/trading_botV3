const crypto = require("crypto");

// ============================================================
// WEEX CONFIG
// ============================================================

const WEEX_BASE_URL = "https://api-contract.weex.com";

const TP_SL_RATE_LIMIT_MS = 10500;

// ============================================================
// WEEX EXECUTION
// ============================================================

class WeexExecution {
  constructor(config = {}) {
    this.baseUrl =
      config.baseUrl ||
      process.env.WEEX_BASE_URL ||
      WEEX_BASE_URL;

    this.apiKey =
      config.apiKey ||
      process.env.WEEX_API_KEY ||
      "";

    this.secretKey =
      config.secretKey ||
      process.env.WEEX_API_SECRET ||
      process.env.WEEX_SECRET_KEY ||
      "";

    this.passphrase =
      config.passphrase ||
      process.env.WEEX_API_PASSPHRASE ||
      "";

    this.authEnabled = Boolean(
      this.apiKey &&
      this.secretKey &&
      this.passphrase
    );

    this.lastTpSlRequestAt = 0;

    this.tpSlRateLimitMs = Math.max(
      10000,
      Number(
        config.tpSlRateLimitMs ??
          TP_SL_RATE_LIMIT_MS
      )
    );
  }

  // ==========================================================
  // SLEEP
  // ==========================================================

  async sleep(ms) {
    return new Promise((resolve) =>
      setTimeout(resolve, ms)
    );
  }

  // ==========================================================
  // TP / SL RATE LIMIT
  // ==========================================================

  async waitForTpSlRateLimit() {
    const now = Date.now();

    const elapsed =
      now - this.lastTpSlRequestAt;

    const remaining =
      this.tpSlRateLimitMs - elapsed;

    if (remaining > 0) {
      console.log(
        `[Execution] TP/SL rate limit | Waiting ${(
          remaining / 1000
        ).toFixed(1)}s`
      );

      await this.sleep(remaining);
    }

    this.lastTpSlRequestAt = Date.now();
  }

  // ==========================================================
  // QUERY BUILDER
  // ==========================================================

  buildQuery(params = {}) {
    const entries = Object.entries(params)
      .filter(
        ([, value]) =>
          value !== undefined &&
          value !== null &&
          value !== ""
      )
      .sort(([a], [b]) =>
        a.localeCompare(b)
      );

    if (!entries.length) {
      return "";
    }

    return (
      "?" +
      entries
        .map(
          ([key, value]) =>
            `${encodeURIComponent(
              key
            )}=${encodeURIComponent(value)}`
        )
        .join("&")
    );
  }

  // ==========================================================
  // SIGNATURE
  // ==========================================================

  createSignature({
    timestamp,
    method,
    requestPath,
    queryString = "",
    body = "",
  }) {
    const prehash =
      String(timestamp) +
      String(method).toUpperCase() +
      String(requestPath) +
      String(queryString) +
      String(body || "");

    return crypto
      .createHmac(
        "sha256",
        this.secretKey
      )
      .update(prehash)
      .digest("base64");
  }

  // ==========================================================
  // REQUEST
  // ==========================================================

  async request(
    method,
    path,
    params = {},
    authenticated = false
  ) {
    const normalizedMethod =
      String(method).toUpperCase();

    let queryString = "";
    let body = "";

    if (
      normalizedMethod === "GET" ||
      normalizedMethod === "DELETE"
    ) {
      queryString =
        this.buildQuery(params);
    } else {
      body = JSON.stringify(params);
    }

    const timestamp =
      Date.now().toString();

    const url =
      `${this.baseUrl}${path}` +
      queryString;

    const headers = {
      "Content-Type":
        "application/json",
    };

    if (
      authenticated ||
      this.authEnabled
    ) {
      if (!this.authEnabled) {
        throw new Error(
          "WEEX authentication credentials are missing."
        );
      }

      const signature =
        this.createSignature({
          timestamp,
          method: normalizedMethod,
          requestPath: path,
          queryString,
          body,
        });

      headers[
        "ACCESS-KEY"
      ] = this.apiKey;

      headers[
        "ACCESS-SIGN"
      ] = signature;

      headers[
        "ACCESS-PASSPHRASE"
      ] = this.passphrase;

      headers[
        "ACCESS-TIMESTAMP"
      ] = timestamp;
    }

    let response;

    try {
      response = await fetch(url, {
        method: normalizedMethod,
        headers,
        body:
          normalizedMethod === "GET" ||
          normalizedMethod === "DELETE"
            ? undefined
            : body,
      });
    } catch (error) {
      throw new Error(
        `WEEX NETWORK ERROR: ${error.message}`
      );
    }

    const responseText =
      await response.text();

    let data;

    try {
      data = responseText
        ? JSON.parse(responseText)
        : {};
    } catch {
      data = responseText;
    }

    if (!response.ok) {
      throw new Error(
        `WEEX HTTP ${response.status}: ${
          typeof data === "string"
            ? data
            : JSON.stringify(data)
        }`
      );
    }

    return data;
  }

  // ==========================================================
  // TICKER
  // ==========================================================

  async getTicker(symbol) {
    const normalizedSymbol =
      String(symbol).toUpperCase();

    const data = await this.request(
      "GET",
      "/capi/v3/market/ticker",
      {
        symbol: normalizedSymbol,
      },
      false
    );

    return data;
  }

  // ==========================================================
  // ORDER BOOK
  // ==========================================================

  async getOrderBook(
    symbol,
    limit = 200
  ) {
    const normalizedSymbol =
      String(symbol).toUpperCase();

    return this.request(
      "GET",
      "/capi/v3/market/depth",
      {
        symbol: normalizedSymbol,
        limit,
      },
      false
    );
  }

  // ==========================================================
  // CURRENT PRICE
  // ==========================================================

  async getCurrentPrice(symbol) {
    const normalizedSymbol =
      String(symbol).toUpperCase();

    const ticker =
      await this.getTicker(
        normalizedSymbol
      );

    if (!ticker) {
      throw new Error(
        `WEEX ticker returned empty response for ${normalizedSymbol}`
      );
    }

    const price =
      Number(
        ticker.lastPrice ??
        ticker.last ??
        ticker.price ??
        ticker.data?.lastPrice ??
        ticker.data?.last
      );

    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {
      throw new Error(
        `Invalid WEEX price for ${normalizedSymbol}: ${JSON.stringify(
          ticker
        )}`
      );
    }

    return price;
  }

// ==========================================================
// GET LIVE POSITION
// ==========================================================

async getPosition({
  symbol,
  positionSide,
}) {
  const normalizedSymbol =
    String(symbol).toUpperCase();

  const normalizedPositionSide =
    String(positionSide).toUpperCase();

  console.log(
    `[Execution] GET POSITION ${normalizedSymbol} ${normalizedPositionSide}`
  );

  // WEEX V3 singlePosition uses SYMBOL only.
  // The returned position direction is in `side`.
  const data = await this.request(
    "GET",
    "/capi/v3/account/position/singlePosition",
    {
      symbol: normalizedSymbol,
    },
    true
  );

  let positions = [];

  if (Array.isArray(data)) {
    positions = data;
  } else if (Array.isArray(data?.data)) {
    positions = data.data;
  } else if (
    data?.data &&
    typeof data.data === "object"
  ) {
    positions = [data.data];
  } else if (
    data &&
    typeof data === "object"
  ) {
    positions = [data];
  }

  const position = positions.find((item) => {
    const itemSymbol =
      String(
        item?.symbol ?? ""
      ).toUpperCase();

    const itemSide =
      String(
        item?.side ??
        item?.positionSide ??
        ""
      ).toUpperCase();

    return (
      itemSymbol === normalizedSymbol &&
      itemSide === normalizedPositionSide
    );
  });

  if (!position) {
    console.log(
      `[Execution] NO POSITION ${normalizedSymbol} ${normalizedPositionSide}`
    );

    return {
      success: true,
      connected: true,
      authenticated:
        this.authEnabled,
      symbol: normalizedSymbol,
      positionSide:
        normalizedPositionSide,
      hasPosition: false,
      size: 0,
      openValue: 0,
      averageEntryPrice: null,
      leverage: null,
      marginType: null,
      positionId: null,
      raw: data,
    };
  }

  const size = Number(
    position.size ??
    position.positionSize ??
    position.qty ??
    position.quantity ??
    0
  );

  const openValue = Number(
    position.openValue ??
    position.openAmount ??
    0
  );

  let averageEntryPrice =
    Number(
      position.averageEntryPrice ??
      position.avgPrice ??
      position.avgEntryPrice ??
      position.entryPrice ??
      0
    );

  // WEEX V3 normally gives openValue + size.
  // Calculate the real average entry when no direct
  // average-entry field is returned.
  if (
    (!Number.isFinite(
      averageEntryPrice
    ) ||
      averageEntryPrice <= 0) &&
    Number.isFinite(size) &&
    size > 0 &&
    Number.isFinite(openValue) &&
    openValue > 0
  ) {
    averageEntryPrice =
      this.calculateAverageEntry({
        openValue,
        size,
      });
  }

  const result = {
    success: true,
    connected: true,
    authenticated:
      this.authEnabled,

    symbol:
      normalizedSymbol,

    positionSide:
      normalizedPositionSide,

    hasPosition:
      Number.isFinite(size) &&
      size > 0,

    size:
      Number.isFinite(size)
        ? size
        : 0,

    openValue:
      Number.isFinite(openValue)
        ? openValue
        : 0,

    averageEntryPrice:
      Number.isFinite(
        averageEntryPrice
      ) &&
      averageEntryPrice > 0
        ? averageEntryPrice
        : null,

    leverage:
      position.leverage ??
      null,

    marginType:
      position.marginType ??
      position.margin_mode ??
      position.marginMode ??
      null,

    positionId:
      position.id ??
      position.positionId ??
      null,

    raw: position,
  };

  console.log(
    `[Execution] WEEX POSITION ${normalizedSymbol} ${normalizedPositionSide}`
  );

  console.log(
    `[Execution] Size=${result.size}`
  );

  console.log(
    `[Execution] OpenValue=${result.openValue}`
  );

  console.log(
    `[Execution] AverageEntry=${result.averageEntryPrice}`
  );

  console.log(
    `[Execution] Position ID=${result.positionId}`
  );

  return result;
}


  // ==========================================================
  // CALCULATE AVERAGE ENTRY
  // ==========================================================

  calculateAverageEntry({
    openValue,
    size,
  }) {
    const numericOpenValue =
      Number(openValue);

    const numericSize =
      Number(size);

    if (
      !Number.isFinite(
        numericOpenValue
      ) ||
      !Number.isFinite(
        numericSize
      ) ||
      numericOpenValue <= 0 ||
      numericSize <= 0
    ) {
      return null;
    }

    return (
      numericOpenValue /
      numericSize
    );
  }

  // ==========================================================
  // OPEN POSITION
  // ==========================================================

  async openPosition({
    symbol,
    direction,
    quantity,
    clientOrderId,
  }) {
    const normalizedSymbol =
      String(symbol).toUpperCase();

    const normalizedDirection =
      String(direction).toUpperCase();

    if (
      normalizedDirection !==
        "LONG" &&
      normalizedDirection !==
        "SHORT"
    ) {
      throw new Error(
        `Invalid position direction: ${direction}`
      );
    }

    const numericContracts =
      Number(quantity);

    if (
      !Number.isFinite(
        numericContracts
      ) ||
      numericContracts <= 0
    ) {
      throw new Error(
        `Invalid order quantity: ${quantity}`
      );
    }

    const orderSide =
      normalizedDirection ===
      "LONG"
        ? "BUY"
        : "SELL";

    const newClientOrderId =
      clientOrderId ||
      `adv-open-${Date.now()}`;

    console.log(
      `[Execution] LIVE OPEN ${normalizedDirection} ${normalizedSymbol}`
    );

    console.log(
      `[Execution] Side=${orderSide}`
    );

    console.log(
      `[Execution] Position Side=${normalizedDirection}`
    );

    console.log(
      `[Execution] Type=MARKET`
    );

    console.log(
      `[Execution] Contracts=${numericContracts}`
    );

    const body = {
      symbol: normalizedSymbol,
      side: orderSide,
      positionSide:
        normalizedDirection,
      type: "MARKET",
      quantity:
        String(numericContracts),
      newClientOrderId,
      reduceOnly: false,
    };

    console.log(
      `[Execution] OPEN REQUEST BODY`
    );

    console.log(
      JSON.stringify(body)
    );

    const response =
      await this.request(
        "POST",
        "/capi/v3/order",
        body,
        true
      );

    console.log(
      `[Execution] WEEX OPEN RESPONSE`
    );

    console.log(response);

    if (
      response?.success === false
    ) {
      throw new Error(
        `WEEX OPEN REJECTED: ${
          response.errorMessage ||
          response.errorCode ||
          JSON.stringify(response)
        }`
      );
    }

    if (
      response?.success !== true
    ) {
      throw new Error(
        `WEEX OPEN UNKNOWN RESPONSE: ${JSON.stringify(
          response
        )}`
      );
    }

    console.log(
      `[Execution] LIVE OPEN ACCEPTED ${normalizedSymbol} ${normalizedDirection}`
    );

    console.log(
      `[Execution] WEEX Order ID=${response.orderId}`
    );

    console.log(
      `[Execution] LIVE ORDER SENT SUCCESSFULLY`
    );

    return response;
  }

  // ==========================================================
  // PLACE FULL POSITION STOP LOSS
  //
  // IMPORTANT:
  // quantity comes from the REAL WEEX position.
  // NOTHING IS HARDCODED HERE.
  // ==========================================================

  async placeFullPositionStopLoss({
    symbol,
    positionSide,
    triggerPrice,
    triggerPriceType = "CONTRACT_PRICE",
    clientAlgoId,
    quantity,
  }) {
    const normalizedSymbol =
      String(symbol).toUpperCase();

    const normalizedPositionSide =
      String(positionSide).toUpperCase();

    const normalizedTriggerType =
      String(
        triggerPriceType
      ).toUpperCase();

    const numericTriggerPrice =
      Number(triggerPrice);

    const numericQuantity =
      Number(quantity);

    if (
      !Number.isFinite(
        numericTriggerPrice
      ) ||
      numericTriggerPrice <= 0
    ) {
      throw new Error(
        `Invalid SL trigger price: ${triggerPrice}`
      );
    }

    if (
      !Number.isFinite(
        numericQuantity
      ) ||
      numericQuantity <= 0
    ) {
      throw new Error(
        `Invalid SL position quantity: ${quantity}`
      );
    }

    if (
      normalizedPositionSide !==
        "LONG" &&
      normalizedPositionSide !==
        "SHORT"
    ) {
      throw new Error(
        `Invalid SL position side: ${positionSide}`
      );
    }

    if (
      normalizedTriggerType !==
        "CONTRACT_PRICE" &&
      normalizedTriggerType !==
        "MARK_PRICE"
    ) {
      throw new Error(
        `Invalid SL trigger price type: ${triggerPriceType}`
      );
    }

    await this.waitForTpSlRateLimit();

    const algoId =
      clientAlgoId ||
      `adv-sl-${Date.now()}`;

    const body = {
      symbol: normalizedSymbol,
      clientAlgoId: algoId,
      planType: "STOP_LOSS",
      triggerPrice:
        String(numericTriggerPrice),
      executePrice: "0",

      // ======================================================
      // DYNAMIC REAL POSITION SIZE
      // ======================================================
      quantity:
        String(numericQuantity),

      positionSide:
        normalizedPositionSide,
      triggerPriceType:
        normalizedTriggerType,

      // SL must only reduce the existing position.
      reduceOnly: true,
    };

    console.log(
      `[Execution] PLACE FULL-POSITION STOP LOSS`
    );

    console.log(
      `[Execution] Symbol=${normalizedSymbol}`
    );

    console.log(
      `[Execution] Position Side=${normalizedPositionSide}`
    );

    console.log(
      `[Execution] Trigger Price=${numericTriggerPrice}`
    );

    console.log(
      `[Execution] Trigger Type=${normalizedTriggerType}`
    );

    console.log(
      `[Execution] Quantity=${numericQuantity} (REAL WEEX POSITION)`
    );

    console.log(
      `[Execution] Execute Price=0 (MARKET)`
    );

    console.log(
      `[Execution] Reduce Only=true`
    );

    console.log(
      `[Execution] Client Algo ID=${algoId}`
    );

    console.log(
      `[Execution] SL REQUEST BODY`
    );

    console.log(
      JSON.stringify(body)
    );

    const response =
      await this.request(
        "POST",
        "/capi/v3/placeTpSlOrder",
        body,
        true
      );

    console.log(
      `[Execution] WEEX SL RESPONSE`
    );

    console.log(response);

    const result =
      this.extractAlgoResponse(
        response
      );

    if (!result.success) {
      throw new Error(
        `WEEX STOP LOSS REJECTED: ${
          result.errorMessage ||
          result.errorCode ||
          JSON.stringify(response)
        }`
      );
    }

    console.log(
      `[Execution] STOP LOSS ACCEPTED ${normalizedSymbol} ${normalizedPositionSide}`
    );

    console.log(
      `[Execution] SL Order ID=${result.orderId}`
    );

    return {
      success: true,
      symbol: normalizedSymbol,
      positionSide:
        normalizedPositionSide,
      triggerPrice:
        numericTriggerPrice,
      triggerPriceType:
        normalizedTriggerType,
      quantity:
        numericQuantity,
      fullPosition: true,
      reduceOnly: true,
      clientAlgoId: algoId,
      orderId: result.orderId,
      raw: response,
    };
  }

  // ==========================================================
  // PLACE FULL POSITION TAKE PROFIT
  // ==========================================================

  async placeFullPositionTakeProfit({
    symbol,
    positionSide,
    triggerPrice,
    triggerPriceType = "CONTRACT_PRICE",
    clientAlgoId,
    quantity,
  }) {
    const normalizedSymbol =
      String(symbol).toUpperCase();

    const normalizedPositionSide =
      String(positionSide).toUpperCase();

    const normalizedTriggerType =
      String(
        triggerPriceType
      ).toUpperCase();

    const numericTriggerPrice =
      Number(triggerPrice);

    const numericQuantity =
      Number(quantity);

    if (
      !Number.isFinite(
        numericTriggerPrice
      ) ||
      numericTriggerPrice <= 0
    ) {
      throw new Error(
        `Invalid TP trigger price: ${triggerPrice}`
      );
    }

    if (
      !Number.isFinite(
        numericQuantity
      ) ||
      numericQuantity <= 0
    ) {
      throw new Error(
        `Invalid TP position quantity: ${quantity}`
      );
    }

    if (
      normalizedPositionSide !==
        "LONG" &&
      normalizedPositionSide !==
        "SHORT"
    ) {
      throw new Error(
        `Invalid TP position side: ${positionSide}`
      );
    }

    if (
      normalizedTriggerType !==
        "CONTRACT_PRICE" &&
      normalizedTriggerType !==
        "MARK_PRICE"
    ) {
      throw new Error(
        `Invalid TP trigger price type: ${triggerPriceType}`
      );
    }

    await this.waitForTpSlRateLimit();

    const algoId =
      clientAlgoId ||
      `adv-tp-${Date.now()}`;

    const body = {
      symbol: normalizedSymbol,
      clientAlgoId: algoId,
      planType: "TAKE_PROFIT",
      triggerPrice:
        String(numericTriggerPrice),
      executePrice: "0",

      // Use the real live position quantity.
      quantity:
        String(numericQuantity),

      positionSide:
        normalizedPositionSide,
      triggerPriceType:
        normalizedTriggerType,

      reduceOnly: true,
    };

    console.log(
      `[Execution] PLACE FULL-POSITION TAKE PROFIT`
    );

    console.log(
      `[Execution] Symbol=${normalizedSymbol}`
    );

    console.log(
      `[Execution] Position Side=${normalizedPositionSide}`
    );

    console.log(
      `[Execution] Trigger Price=${numericTriggerPrice}`
    );

    console.log(
      `[Execution] Trigger Type=${normalizedTriggerType}`
    );

    console.log(
      `[Execution] Quantity=${numericQuantity} (REAL WEEX POSITION)`
    );

    console.log(
      `[Execution] Execute Price=0 (MARKET)`
    );

    console.log(
      `[Execution] Reduce Only=true`
    );

    console.log(
      `[Execution] Client Algo ID=${algoId}`
    );

    console.log(
      `[Execution] TP REQUEST BODY`
    );

    console.log(
      JSON.stringify(body)
    );

    const response =
      await this.request(
        "POST",
        "/capi/v3/placeTpSlOrder",
        body,
        true
      );

    console.log(
      `[Execution] WEEX TP RESPONSE`
    );

    console.log(response);

    const result =
      this.extractAlgoResponse(
        response
      );

    if (!result.success) {
      throw new Error(
        `WEEX TAKE PROFIT REJECTED: ${
          result.errorMessage ||
          result.errorCode ||
          JSON.stringify(response)
        }`
      );
    }

    console.log(
      `[Execution] TAKE PROFIT ACCEPTED ${normalizedSymbol} ${normalizedPositionSide}`
    );

    console.log(
      `[Execution] TP Order ID=${result.orderId}`
    );

    return {
      success: true,
      symbol: normalizedSymbol,
      positionSide:
        normalizedPositionSide,
      triggerPrice:
        numericTriggerPrice,
      triggerPriceType:
        normalizedTriggerType,
      quantity:
        numericQuantity,
      fullPosition: true,
      reduceOnly: true,
      clientAlgoId: algoId,
      orderId: result.orderId,
      raw: response,
    };
  }

  // ==========================================================
  // EXTRACT TP/SL RESPONSE
  // ==========================================================

  extractAlgoResponse(response) {
    let item = response;

    if (Array.isArray(response)) {
      item = response[0];
    }

    if (
      response?.data &&
      Array.isArray(response.data)
    ) {
      item = response.data[0];
    } else if (
      response?.data &&
      typeof response.data === "object"
    ) {
      item = response.data;
    }

    if (!item) {
      return {
        success: false,
        orderId: null,
        errorCode:
          "EMPTY_RESPONSE",
        errorMessage:
          "WEEX returned an empty TP/SL response.",
      };
    }

    return {
      success:
        item.success === true,

      orderId:
        item.orderId ??
        item.orderID ??
        null,

      errorCode:
        item.errorCode ??
        null,

      errorMessage:
        item.errorMessage ??
        null,

      raw: response,
    };
  }

  // ==========================================================
  // MODIFY STOP LOSS
  // ==========================================================

  async modifyFullPositionStopLoss({
    orderId,
    triggerPrice,
    triggerPriceType = "CONTRACT_PRICE",
  }) {
    const numericOrderId =
      orderId;

    const numericTriggerPrice =
      Number(triggerPrice);

    if (
      numericTriggerPrice <= 0 ||
      !Number.isFinite(
        numericTriggerPrice
      )
    ) {
      throw new Error(
        `Invalid SL trigger price: ${triggerPrice}`
      );
    }

    await this.waitForTpSlRateLimit();

    const body = {
      orderId:
        numericOrderId,
      triggerPrice:
        String(numericTriggerPrice),
      executePrice: "0",
      triggerPriceType:
        String(
          triggerPriceType
        ).toUpperCase(),
    };

    console.log(
      `[Execution] MODIFY STOP LOSS`
    );

    console.log(
      `[Execution] Order ID=${numericOrderId}`
    );

    console.log(
      `[Execution] Trigger Price=${numericTriggerPrice}`
    );

    console.log(
      `[Execution] MODIFY SL REQUEST BODY`
    );

    console.log(
      JSON.stringify(body)
    );

    const response =
      await this.request(
        "POST",
        "/capi/v3/modifyTpSlOrder",
        body,
        true
      );

    console.log(
      `[Execution] WEEX MODIFY SL RESPONSE`
    );

    console.log(response);

    if (
      response?.success === false
    ) {
      throw new Error(
        `WEEX MODIFY STOP LOSS REJECTED: ${
          response.errorMessage ||
          response.errorCode ||
          JSON.stringify(response)
        }`
      );
    }

    return {
      success: true,
      orderId:
        numericOrderId,
      triggerPrice:
        numericTriggerPrice,
      raw: response,
    };
  }

  // ==========================================================
  // MODIFY TAKE PROFIT
  // ==========================================================

  async modifyFullPositionTakeProfit({
    orderId,
    triggerPrice,
    triggerPriceType = "CONTRACT_PRICE",
  }) {
    const numericOrderId =
      orderId;

    const numericTriggerPrice =
      Number(triggerPrice);

    if (
      numericTriggerPrice <= 0 ||
      !Number.isFinite(
        numericTriggerPrice
      )
    ) {
      throw new Error(
        `Invalid TP trigger price: ${triggerPrice}`
      );
    }

    await this.waitForTpSlRateLimit();

    const body = {
      orderId:
        numericOrderId,
      triggerPrice:
        String(numericTriggerPrice),
      executePrice: "0",
      triggerPriceType:
        String(
          triggerPriceType
        ).toUpperCase(),
    };

    console.log(
      `[Execution] MODIFY TAKE PROFIT`
    );

    console.log(
      `[Execution] Order ID=${numericOrderId}`
    );

    console.log(
      `[Execution] Trigger Price=${numericTriggerPrice}`
    );

    console.log(
      `[Execution] MODIFY TP REQUEST BODY`
    );

    console.log(
      JSON.stringify(body)
    );

    const response =
      await this.request(
        "POST",
        "/capi/v3/modifyTpSlOrder",
        body,
        true
      );

    console.log(
      `[Execution] WEEX MODIFY TP RESPONSE`
    );

    console.log(response);

    if (
      response?.success === false
    ) {
      throw new Error(
        `WEEX MODIFY TAKE PROFIT REJECTED: ${
          response.errorMessage ||
          response.errorCode ||
          JSON.stringify(response)
        }`
      );
    }

    return {
      success: true,
      orderId:
        numericOrderId,
      triggerPrice:
        numericTriggerPrice,
      raw: response,
    };
  }

  // ==========================================================
  // CLOSE POSITION
  // ==========================================================

  async closePosition({
    symbol,
    positionSide,
    positionId,
  }) {
    const normalizedSymbol =
      String(symbol).toUpperCase();

    const normalizedPositionSide =
      String(positionSide).toUpperCase();

    const body = {
      symbol:
        normalizedSymbol,
    };

    if (
      positionId !== undefined &&
      positionId !== null &&
      positionId !== ""
    ) {
      body.positionId =
        String(positionId);
    }

    console.log(
      `[Execution] LIVE CLOSE ${normalizedSymbol} ${normalizedPositionSide}`
    );

    console.log(
      `[Execution] CLOSE REQUEST BODY`
    );

    console.log(
      JSON.stringify(body)
    );

    const response =
      await this.request(
        "POST",
        "/capi/v3/closePositions",
        body,
        true
      );

    console.log(
      `[Execution] WEEX CLOSE RESPONSE`
    );

    console.log(response);

    if (
      response?.success === false
    ) {
      throw new Error(
        `WEEX CLOSE REJECTED: ${
          response.errorMessage ||
          response.errorCode ||
          JSON.stringify(response)
        }`
      );
    }

    console.log(
      `[Execution] LIVE CLOSE ACCEPTED ${normalizedSymbol} ${normalizedPositionSide}`
    );

    return {
      success: true,
      symbol: normalizedSymbol,
      positionSide:
        normalizedPositionSide,
      raw: response,
    };
  }
}

// ============================================================
// EXPORT
// ============================================================

module.exports = WeexExecution;