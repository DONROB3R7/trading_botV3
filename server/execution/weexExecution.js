const crypto = require("crypto");

const WEEX_BASE_URL =
  "https://api-contract.weex.com";


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

    this.authEnabled =
      Boolean(
        this.apiKey &&
        this.secretKey &&
        this.passphrase
      );
  }


  // ============================================================
  // NORMALIZE QUERY
  // ============================================================

  buildQuery(params = {}) {
    const entries =
      Object.entries(params)
        .filter(
          ([, value]) =>
            value !== undefined &&
            value !== null &&
            value !== ""
        );

    if (!entries.length) {
      return "";
    }

    return entries
      .map(
        ([key, value]) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(
            String(value)
          )}`
      )
      .join("&");
  }


  // ============================================================
  // WEEX SIGNATURE
  //
  // timestamp + METHOD + requestPath + ?query + body
  //
  // HMAC SHA256 -> Base64
  // ============================================================

  createSignature({
    timestamp,
    method,
    requestPath,
    queryString = "",
    bodyString = "",
  }) {
    const normalizedMethod =
      String(method || "GET")
        .trim()
        .toUpperCase();

    let message =
      `${timestamp}${normalizedMethod}${requestPath}`;

    if (queryString) {
      message += `?${queryString}`;
    }

    if (bodyString) {
      message += bodyString;
    }

    return crypto
      .createHmac(
        "sha256",
        this.secretKey
      )
      .update(message)
      .digest("base64");
  }


  // ============================================================
  // GENERIC REQUEST
  // ============================================================

  async request(
    path,
    options = {}
  ) {
    const method =
      String(
        options.method || "GET"
      )
        .trim()
        .toUpperCase();

    const queryString =
      options.queryString || "";

    const bodyString =
      options.bodyString || "";

    const requiresAuth =
      Boolean(
        options.auth
      );

    const url =
      `${this.baseUrl}${path}` +
      (
        queryString
          ? `?${queryString}`
          : ""
      );

    const headers = {
      "Content-Type":
        "application/json",
      ...(options.headers || {}),
    };


    // ==========================================================
    // AUTHENTICATION
    // ==========================================================

    if (requiresAuth) {
      if (!this.authEnabled) {
        throw new Error(
          "WEEX authentication is not configured. Set WEEX_API_KEY, WEEX_API_SECRET and WEEX_API_PASSPHRASE."
        );
      }

      const timestamp =
        String(
          Date.now()
        );

      const signature =
        this.createSignature({
          timestamp,
          method,
          requestPath:
            path,
          queryString,
          bodyString,
        });

      headers[
        "ACCESS-KEY"
      ] =
        this.apiKey;

      headers[
        "ACCESS-SIGN"
      ] =
        signature;

      headers[
        "ACCESS-PASSPHRASE"
      ] =
        this.passphrase;

      headers[
        "ACCESS-TIMESTAMP"
      ] =
        timestamp;
    }


    const response =
      await fetch(
        url,
        {
          method,
          headers,

          body:
            bodyString
              ? bodyString
              : undefined,
        }
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
      data =
        JSON.parse(text);

    } catch {
      throw new Error(
        "WEEX returned invalid JSON"
      );
    }


    return data;
  }


  // ============================================================
  // TICKER
  // ============================================================

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

    const queryString =
      this.buildQuery({
        symbol:
          normalizedSymbol,
      });

    return this.request(
      "/capi/v3/market/ticker/bookTicker",
      {
        method:
          "GET",

        queryString,

        auth:
          false,
      }
    );
  }


  // ============================================================
  // ORDER BOOK
  // ============================================================

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

    const queryString =
      this.buildQuery({
        symbol:
          normalizedSymbol,

        limit:
          limit,
      });

    return this.request(
      "/capi/v3/market/depth",
      {
        method:
          "GET",

        queryString,

        auth:
          false,
      }
    );
  }


  // ============================================================
  // CURRENT MARKET PRICE
  // ============================================================

  async getCurrentPrice(symbol) {
    const ticker =
      await this.getTicker(
        symbol
      );

    let data =
      ticker;

    if (
      Array.isArray(data)
    ) {
      data =
        data[0];
    }

    if (
      !data ||
      typeof data !== "object"
    ) {
      return null;
    }

    let candidate =
      data;

    if (
      Array.isArray(data.data)
    ) {
      candidate =
        data.data[0] ||
        {};
    } else if (
      data.data &&
      typeof data.data === "object"
    ) {
      candidate =
        data.data;
    }

    if (
      candidate.ticker &&
      typeof candidate.ticker === "object"
    ) {
      candidate =
        candidate.ticker;
    }

    const bid =
      Number(
        candidate.bidPrice ??
        candidate.bid ??
        data.bidPrice ??
        data.bid ??
        NaN
      );

    const ask =
      Number(
        candidate.askPrice ??
        candidate.ask ??
        data.askPrice ??
        data.ask ??
        NaN
      );

    const last =
      Number(
        candidate.lastPrice ??
        candidate.last ??
        candidate.price ??
        data.lastPrice ??
        data.last ??
        data.price ??
        NaN
      );


    if (
      Number.isFinite(bid) &&
      bid > 0 &&
      Number.isFinite(ask) &&
      ask > 0
    ) {
      return (
        bid + ask
      ) / 2;
    }


    if (
      Number.isFinite(bid) &&
      bid > 0
    ) {
      return bid;
    }


    if (
      Number.isFinite(ask) &&
      ask > 0
    ) {
      return ask;
    }


    if (
      Number.isFinite(last) &&
      last > 0
    ) {
      return last;
    }


    return null;
  }


  // ============================================================
  // REAL WEEX POSITION
  //
  // GET /capi/v3/account/position/singlePosition
  // ============================================================

  async getPosition({
    symbol,
    positionSide,
  }) {
    const normalizedSymbol =
      String(symbol)
        .trim()
        .toUpperCase();

    const normalizedPositionSide =
      String(positionSide)
        .trim()
        .toUpperCase();


    if (!normalizedSymbol) {
      throw new Error(
        "Get position requires a symbol"
      );
    }


    if (
      normalizedPositionSide !==
        "LONG" &&
      normalizedPositionSide !==
        "SHORT"
    ) {
      throw new Error(
        "Get position positionSide must be LONG or SHORT"
      );
    }


    console.log(
      `[Execution] GET POSITION ${normalizedSymbol} ${normalizedPositionSide}`
    );


    if (!this.authEnabled) {
      console.log(
        `[Execution] WEEX authentication is not configured`
      );

      return {
        success:
          false,

        connected:
          false,

        authenticated:
          false,

        simulated:
          true,

        symbol:
          normalizedSymbol,

        positionSide:
          normalizedPositionSide,

        hasPosition:
          false,

        size:
          0,

        openValue:
          0,

        averageEntryPrice:
          null,

        reason:
          "WEEX authentication is not configured",
      };
    }


    try {
      const queryString =
        this.buildQuery({
          symbol:
            normalizedSymbol,
        });


      const response =
        await this.request(
          "/capi/v3/account/position/singlePosition",
          {
            method:
              "GET",

            queryString,

            auth:
              true,
          }
        );


      // ========================================================
      // WEEX normally returns an array.
      // ========================================================

      let positions =
        response;


      if (
        response &&
        Array.isArray(response.data)
      ) {
        positions =
          response.data;
      }


      if (
        response &&
        response.data &&
        typeof response.data === "object" &&
        !Array.isArray(response.data)
      ) {
        positions =
          [response.data];
      }


      if (
        !Array.isArray(positions)
      ) {
        positions =
          [];
      }


      // ========================================================
      // Find requested side.
      // ========================================================

      const position =
        positions.find(
          (item) => {
            if (
              !item ||
              typeof item !== "object"
            ) {
              return false;
            }

            const itemSymbol =
              String(
                item.symbol ||
                ""
              )
                .trim()
                .toUpperCase();

            const itemSide =
              String(
                item.side ||
                item.positionSide ||
                ""
              )
                .trim()
                .toUpperCase();

            return (
              itemSymbol ===
                normalizedSymbol &&
              itemSide ===
                normalizedPositionSide
            );
          }
        );


      // ========================================================
      // No matching position.
      // ========================================================

      if (!position) {
        console.log(
          `[Execution] WEEX POSITION ${normalizedSymbol} ${normalizedPositionSide} = FLAT`
        );

        return {
          success:
            true,

          connected:
            true,

          authenticated:
            true,

          simulated:
            false,

          symbol:
            normalizedSymbol,

          positionSide:
            normalizedPositionSide,

          hasPosition:
            false,

          size:
            0,

          openValue:
            0,

          averageEntryPrice:
            null,

          raw:
            response,
        };
      }


      // ========================================================
      // Parse size/open value.
      // ========================================================

      const size =
        Number(
          position.size ??
          position.positionSize ??
          0
        );


      const openValue =
        Number(
          position.openValue ??
          position.positionValue ??
          0
        );


      let averageEntryPrice =
        null;


      if (
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


      // ========================================================
      // Some responses may expose entry price directly.
      // Use it only if available.
      // ========================================================

      if (
        !Number.isFinite(
          averageEntryPrice
        )
      ) {
        const directAverage =
          Number(
            position.averageEntryPrice ??
            position.avgEntryPrice ??
            position.entryPrice ??
            NaN
          );

        if (
          Number.isFinite(
            directAverage
          ) &&
          directAverage > 0
        ) {
          averageEntryPrice =
            directAverage;
        }
      }


      const hasPosition =
        Number.isFinite(size) &&
        size > 0;


      console.log(
        `[Execution] WEEX POSITION ${normalizedSymbol} ${normalizedPositionSide}`
      );

      console.log(
        `[Execution] Size=${size}`
      );

      console.log(
        `[Execution] OpenValue=${openValue}`
      );

      console.log(
        `[Execution] AverageEntry=${averageEntryPrice ?? "UNKNOWN"}`
      );


      return {
        success:
          true,

        connected:
          true,

        authenticated:
          true,

        simulated:
          false,

        symbol:
          normalizedSymbol,

        positionSide:
          normalizedPositionSide,

        hasPosition:
          hasPosition,

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
          )
            ? averageEntryPrice
            : null,

        leverage:
          position.leverage ??
          null,

        marginType:
          position.marginType ??
          null,

        raw:
          position,
      };

    } catch (error) {
      console.error(
        `[Execution] GET POSITION ERROR ${normalizedSymbol} ${normalizedPositionSide}: ${error.message}`
      );

      return {
        success:
          false,

        connected:
          true,

        authenticated:
          true,

        simulated:
          false,

        symbol:
          normalizedSymbol,

        positionSide:
          normalizedPositionSide,

        hasPosition:
          false,

        size:
          0,

        openValue:
          0,

        averageEntryPrice:
          null,

        error:
          error.message,

        reason:
          "WEEX position request failed",
      };
    }
  }


  // ============================================================
  // LOCAL AVERAGE ENTRY CALCULATION
  // ============================================================

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
      numericOpenValue <= 0
    ) {
      return null;
    }


    if (
      !Number.isFinite(
        numericSize
      ) ||
      numericSize <= 0
    ) {
      return null;
    }


    const averageEntryPrice =
      numericOpenValue /
      numericSize;


    if (
      !Number.isFinite(
        averageEntryPrice
      ) ||
      averageEntryPrice <= 0
    ) {
      return null;
    }


    return averageEntryPrice;
  }


  // ============================================================
  // OPEN POSITION
  // WEEX V3 LIVE MARKET ORDER
  //
  // POST /capi/v3/order
  // ============================================================

  async openPosition({
    symbol,
    direction,
    contracts,
    leverage,
    marginUSDT,
    actualNotional,
    estimatedMargin,
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

    const numericContracts =
      Number(contracts);

    const numericLeverage =
      Number(leverage);

    const numericMargin =
      Number(marginUSDT);

    const numericNotional =
      Number(actualNotional);

    const numericEstimatedMargin =
      Number(estimatedMargin);

    if (
      !Number.isFinite(numericContracts) ||
      numericContracts <= 0
    ) {
      throw new Error(
        "Open position requires valid contracts"
      );
    }

    if (
      !Number.isFinite(numericLeverage) ||
      numericLeverage <= 0
    ) {
      throw new Error(
        "Open position requires valid leverage"
      );
    }

    if (
      !Number.isFinite(numericMargin) ||
      numericMargin <= 0
    ) {
      throw new Error(
        "Open position requires valid margin"
      );
    }

    if (
      !Number.isFinite(numericNotional) ||
      numericNotional <= 0
    ) {
      throw new Error(
        "Open position requires valid actual notional"
      );
    }

    if (
      !Number.isFinite(numericEstimatedMargin) ||
      numericEstimatedMargin <= 0
    ) {
      throw new Error(
        "Open position requires valid estimated margin"
      );
    }

    if (!this.authEnabled) {
      throw new Error(
        "WEEX authentication is required for LIVE openPosition"
      );
    }

    // ==========================================================
    // LONG  = BUY
    // SHORT = SELL
    // ==========================================================

    const orderSide =
      normalizedDirection === "LONG"
        ? "BUY"
        : "SELL";

    // ==========================================================
    // WEEX client order ID
    // Max 36 characters
    // ==========================================================

    const newClientOrderId =
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

    console.log(
      `[Execution] Margin=${numericMargin} USDT`
    );

    console.log(
      `[Execution] Leverage=${numericLeverage}x`
    );

    console.log(
      `[Execution] Notional=${numericNotional.toFixed(4)} USDT`
    );

    console.log(
      `[Execution] Estimated Margin=${numericEstimatedMargin.toFixed(4)} USDT`
    );

    console.log(
      `[Execution] Client Order ID=${newClientOrderId}`
    );

    // ==========================================================
    // IMPORTANT:
    //
    // We intentionally DO NOT send TP/SL with this order.
    //
    // AdvancedBot will create the full-position SL and TP
    // separately after the real position exists.
    // ==========================================================

    const body = {
      symbol:
        normalizedSymbol,

      side:
        orderSide,

      positionSide:
        normalizedDirection,

      type:
        "MARKET",

      quantity:
        String(numericContracts),

      newClientOrderId:
        newClientOrderId,

      reduceOnly:
        false,
    };

    const bodyString =
      JSON.stringify(body);

    try {
      const response =
        await this.request(
          "/capi/v3/order",
          {
            method:
              "POST",

            bodyString:
              bodyString,

            auth:
              true,
          }
        );

      console.log(
        `[Execution] WEEX OPEN RESPONSE`
      );

      console.log(
        response
      );

      if (
        !response ||
        response.success !== true
      ) {
        const errorCode =
          response?.errorCode ||
          "";

        const errorMessage =
          response?.errorMessage ||
          response?.msg ||
          response?.message ||
          "WEEX rejected market order";

        console.error(
          `[Execution] LIVE OPEN REJECTED ${normalizedSymbol} ${normalizedDirection} | Code=${errorCode} | ${errorMessage}`
        );

        return {
          success:
            false,

          simulated:
            false,

          executed:
            false,

          symbol:
            normalizedSymbol,

          direction:
            normalizedDirection,

          side:
            orderSide,

          positionSide:
            normalizedDirection,

          contracts:
            numericContracts,

          leverage:
            numericLeverage,

          marginUSDT:
            numericMargin,

          actualNotional:
            numericNotional,

          estimatedMargin:
            numericEstimatedMargin,

          clientOrderId:
            newClientOrderId,

          errorCode:
            errorCode,

          errorMessage:
            errorMessage,

          raw:
            response,
        };
      }

      const orderId =
        response.orderId ??
        response.orderID ??
        response.id ??
        null;

      console.log(
        `[Execution] LIVE OPEN ACCEPTED ${normalizedSymbol} ${normalizedDirection}`
      );

      console.log(
        `[Execution] WEEX Order ID=${orderId ?? "UNKNOWN"}`
      );

      console.log(
        `[Execution] LIVE ORDER SENT SUCCESSFULLY`
      );

      return {
        success:
          true,

        simulated:
          false,

        executed:
          true,

        symbol:
          normalizedSymbol,

        direction:
          normalizedDirection,

        side:
          orderSide,

        positionSide:
          normalizedDirection,

        contracts:
          numericContracts,

        leverage:
          numericLeverage,

        marginUSDT:
          numericMargin,

        actualNotional:
          numericNotional,

        estimatedMargin:
          numericEstimatedMargin,

        clientOrderId:
          newClientOrderId,

        orderId:
          orderId,

        raw:
          response,
      };

    } catch (error) {
      console.error(
        `[Execution] LIVE OPEN ERROR ${normalizedSymbol} ${normalizedDirection}: ${error.message}`
      );

      return {
        success:
          false,

        simulated:
          false,

        executed:
          false,

        symbol:
          normalizedSymbol,

        direction:
          normalizedDirection,

        side:
          orderSide,

        positionSide:
          normalizedDirection,

        contracts:
          numericContracts,

        leverage:
          numericLeverage,

        marginUSDT:
          numericMargin,

        actualNotional:
          numericNotional,

        estimatedMargin:
          numericEstimatedMargin,

        error:
          error.message,

        reason:
          "WEEX live market order request failed",
      };
    }
  }


  // ============================================================
  // FULL POSITION STOP LOSS
  // WEEX V3 LIVE
  //
  // POST /capi/v3/placeTpSlOrder
  // ============================================================

  async placeFullPositionStopLoss({
    symbol,
    positionSide,
    triggerPrice,
    triggerPriceType = "MARK_PRICE",
    clientAlgoId,
  }) {
    const normalizedSymbol =
      String(symbol)
        .trim()
        .toUpperCase();

    const normalizedPositionSide =
      String(positionSide)
        .trim()
        .toUpperCase();

    const numericTriggerPrice =
      Number(triggerPrice);

    if (!normalizedSymbol) {
      throw new Error(
        "Stop loss requires a symbol"
      );
    }

    if (
      normalizedPositionSide !== "LONG" &&
      normalizedPositionSide !== "SHORT"
    ) {
      throw new Error(
        "Stop loss positionSide must be LONG or SHORT"
      );
    }

    if (
      !Number.isFinite(numericTriggerPrice) ||
      numericTriggerPrice <= 0
    ) {
      throw new Error(
        "Stop loss requires a valid trigger price"
      );
    }

    const normalizedTriggerType =
      String(triggerPriceType)
        .trim()
        .toUpperCase();

    if (
      normalizedTriggerType !== "MARK_PRICE" &&
      normalizedTriggerType !== "CONTRACT_PRICE"
    ) {
      throw new Error(
        "Stop loss triggerPriceType must be MARK_PRICE or CONTRACT_PRICE"
      );
    }

    const algoId =
      String(
        clientAlgoId ||
        `adv-sl-${Date.now()}`
      )
        .trim();

    if (
      algoId.length < 1 ||
      algoId.length > 36
    ) {
      throw new Error(
        "Stop loss clientAlgoId must be 1-36 characters"
      );
    }

    const body = {
      symbol:
        normalizedSymbol,

      clientAlgoId:
        algoId,

      planType:
        "STOP_LOSS",

      triggerPrice:
        String(numericTriggerPrice),

      executePrice:
        "0",

      quantity:
        "0",

      positionSide:
        normalizedPositionSide,

      triggerPriceType:
        normalizedTriggerType,

      reduceOnly:
        false,
    };

    const bodyString =
      JSON.stringify(body);

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
      `[Execution] Quantity=0 (FULL POSITION)`
    );

    console.log(
      `[Execution] Execute Price=0 (MARKET)`
    );

    console.log(
      `[Execution] Client Algo ID=${algoId}`
    );

    if (!this.authEnabled) {
      console.log(
        `[Execution] WEEX authentication is not configured`
      );

      return {
        success:
          false,

        simulated:
          true,

        executed:
          false,

        symbol:
          normalizedSymbol,

        positionSide:
          normalizedPositionSide,

        planType:
          "STOP_LOSS",

        triggerPrice:
          numericTriggerPrice,

        triggerPriceType:
          normalizedTriggerType,

        executePrice:
          0,

        quantity:
          "0",

        clientAlgoId:
          algoId,

        fullPosition:
          true,

        reason:
          "WEEX authentication is not configured",
      };
    }

    try {
      const response =
        await this.request(
          "/capi/v3/placeTpSlOrder",
          {
            method:
              "POST",

            bodyString:
              bodyString,

            auth:
              true,
          }
        );

      console.log(
        `[Execution] WEEX SL RESPONSE`
      );

      console.log(
        response
      );

      let result =
        response;

      if (
        Array.isArray(response)
      ) {
        result =
          response[0] ||
          {};
      }

      if (
        response &&
        Array.isArray(response.data)
      ) {
        result =
          response.data[0] ||
          {};
      }

      if (
        !result ||
        typeof result !== "object"
      ) {
        return {
          success:
            false,

          simulated:
            false,

          executed:
            false,

          symbol:
            normalizedSymbol,

          positionSide:
            normalizedPositionSide,

          planType:
            "STOP_LOSS",

          triggerPrice:
            numericTriggerPrice,

          raw:
            response,

          reason:
            "WEEX returned an invalid SL response",
        };
      }

      if (
        result.success !== true
      ) {
        return {
          success:
            false,

          simulated:
            false,

          executed:
            false,

          symbol:
            normalizedSymbol,

          positionSide:
            normalizedPositionSide,

          planType:
            "STOP_LOSS",

          triggerPrice:
            numericTriggerPrice,

          triggerPriceType:
            normalizedTriggerType,

          executePrice:
            0,

          quantity:
            "0",

          clientAlgoId:
            algoId,

          errorCode:
            result.errorCode ||
            "",

          errorMessage:
            result.errorMessage ||
            result.msg ||
            result.message ||
            "WEEX rejected stop loss order",

          raw:
            response,
        };
      }

      const orderId =
        result.orderId ??
        result.orderID ??
        result.id ??
        null;

      if (
        orderId === null ||
        orderId === undefined ||
        String(orderId).trim() === ""
      ) {
        console.error(
          `[Execution] WEEX accepted SL but returned no orderId`
        );

        return {
          success:
            false,

          simulated:
            false,

          executed:
            false,

          symbol:
            normalizedSymbol,

          positionSide:
            normalizedPositionSide,

          planType:
            "STOP_LOSS",

          triggerPrice:
            numericTriggerPrice,

          triggerPriceType:
            normalizedTriggerType,

          clientAlgoId:
            algoId,

          raw:
            response,

          reason:
            "WEEX accepted SL but no orderId was returned",
        };
      }

      console.log(
        `[Execution] WEEX SL CREATED SUCCESSFULLY`
      );

      console.log(
        `[Execution] SL Order ID=${orderId}`
      );

      return {
        success:
          true,

        simulated:
          false,

        executed:
          true,

        symbol:
          normalizedSymbol,

        positionSide:
          normalizedPositionSide,

        planType:
          "STOP_LOSS",

        triggerPrice:
          numericTriggerPrice,

        triggerPriceType:
          normalizedTriggerType,

        executePrice:
          0,

        quantity:
          "0",

        clientAlgoId:
          algoId,

        orderId:
          orderId,

        fullPosition:
          true,

        raw:
          response,
      };

    } catch (error) {
      console.error(
        `[Execution] PLACE STOP LOSS ERROR ${normalizedSymbol} ${normalizedPositionSide}: ${error.message}`
      );

      return {
        success:
          false,

        simulated:
          false,

        executed:
          false,

        symbol:
          normalizedSymbol,

        positionSide:
          normalizedPositionSide,

        planType:
          "STOP_LOSS",

        triggerPrice:
          numericTriggerPrice,

        triggerPriceType:
          normalizedTriggerType,

        executePrice:
          0,

        quantity:
          "0",

        clientAlgoId:
          algoId,

        error:
          error.message,

        reason:
          "WEEX SL placement request failed",
      };
    }
  }


  // ============================================================
  // FULL POSITION TAKE PROFIT
  // WEEX V3 LIVE
  //
  // POST /capi/v3/placeTpSlOrder
  // ============================================================

  async placeFullPositionTakeProfit({
    symbol,
    positionSide,
    triggerPrice,
    triggerPriceType = "MARK_PRICE",
    clientAlgoId,
  }) {
    const normalizedSymbol =
      String(symbol)
        .trim()
        .toUpperCase();

    const normalizedPositionSide =
      String(positionSide)
        .trim()
        .toUpperCase();

    const numericTriggerPrice =
      Number(triggerPrice);

    if (!normalizedSymbol) {
      throw new Error(
        "Take profit requires a symbol"
      );
    }

    if (
      normalizedPositionSide !== "LONG" &&
      normalizedPositionSide !== "SHORT"
    ) {
      throw new Error(
        "Take profit positionSide must be LONG or SHORT"
      );
    }

    if (
      !Number.isFinite(numericTriggerPrice) ||
      numericTriggerPrice <= 0
    ) {
      throw new Error(
        "Take profit requires a valid trigger price"
      );
    }

    const normalizedTriggerType =
      String(triggerPriceType)
        .trim()
        .toUpperCase();

    if (
      normalizedTriggerType !== "MARK_PRICE" &&
      normalizedTriggerType !== "CONTRACT_PRICE"
    ) {
      throw new Error(
        "Take profit triggerPriceType must be MARK_PRICE or CONTRACT_PRICE"
      );
    }

    const algoId =
      String(
        clientAlgoId ||
        `adv-tp-${Date.now()}`
      )
        .trim();

    if (
      algoId.length < 1 ||
      algoId.length > 36
    ) {
      throw new Error(
        "Take profit clientAlgoId must be 1-36 characters"
      );
    }

    const body = {
      symbol:
        normalizedSymbol,

      clientAlgoId:
        algoId,

      planType:
        "TAKE_PROFIT",

      triggerPrice:
        String(numericTriggerPrice),

      executePrice:
        "0",

      quantity:
        "0",

      positionSide:
        normalizedPositionSide,

      triggerPriceType:
        normalizedTriggerType,

      reduceOnly:
        false,
    };

    const bodyString =
      JSON.stringify(body);

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
      `[Execution] Quantity=0 (FULL POSITION)`
    );

    console.log(
      `[Execution] Execute Price=0 (MARKET)`
    );

    console.log(
      `[Execution] Client Algo ID=${algoId}`
    );

    if (!this.authEnabled) {
      console.log(
        `[Execution] WEEX authentication is not configured`
      );

      return {
        success:
          false,

        simulated:
          true,

        executed:
          false,

        symbol:
          normalizedSymbol,

        positionSide:
          normalizedPositionSide,

        planType:
          "TAKE_PROFIT",

        triggerPrice:
          numericTriggerPrice,

        triggerPriceType:
          normalizedTriggerType,

        executePrice:
          0,

        quantity:
          "0",

        clientAlgoId:
          algoId,

        fullPosition:
          true,

        reason:
          "WEEX authentication is not configured",
      };
    }

    try {
      const response =
        await this.request(
          "/capi/v3/placeTpSlOrder",
          {
            method:
              "POST",

            bodyString:
              bodyString,

            auth:
              true,
          }
        );

      console.log(
        `[Execution] WEEX TP RESPONSE`
      );

      console.log(
        response
      );

      let result =
        response;

      if (
        Array.isArray(response)
      ) {
        result =
          response[0] ||
          {};
      }

      if (
        response &&
        Array.isArray(response.data)
      ) {
        result =
          response.data[0] ||
          {};
      }

      if (
        !result ||
        typeof result !== "object"
      ) {
        return {
          success:
            false,

          simulated:
            false,

          executed:
            false,

          symbol:
            normalizedSymbol,

          positionSide:
            normalizedPositionSide,

          planType:
            "TAKE_PROFIT",

          triggerPrice:
            numericTriggerPrice,

          raw:
            response,

          reason:
            "WEEX returned an invalid TP response",
        };
      }

      if (
        result.success !== true
      ) {
        return {
          success:
            false,

          simulated:
            false,

          executed:
            false,

          symbol:
            normalizedSymbol,

          positionSide:
            normalizedPositionSide,

          planType:
            "TAKE_PROFIT",

          triggerPrice:
            numericTriggerPrice,

          triggerPriceType:
            normalizedTriggerType,

          executePrice:
            0,

          quantity:
            "0",

          clientAlgoId:
            algoId,

          errorCode:
            result.errorCode ||
            "",

          errorMessage:
            result.errorMessage ||
            result.msg ||
            result.message ||
            "WEEX rejected take profit order",

          raw:
            response,
        };
      }

      const orderId =
        result.orderId ??
        result.orderID ??
        result.id ??
        null;

      if (
        orderId === null ||
        orderId === undefined ||
        String(orderId).trim() === ""
      ) {
        console.error(
          `[Execution] WEEX accepted TP but returned no orderId`
        );

        return {
          success:
            false,

          simulated:
            false,

          executed:
            false,

          symbol:
            normalizedSymbol,

          positionSide:
            normalizedPositionSide,

          planType:
            "TAKE_PROFIT",

          triggerPrice:
            numericTriggerPrice,

          triggerPriceType:
            normalizedTriggerType,

          clientAlgoId:
            algoId,

          raw:
            response,

          reason:
            "WEEX accepted TP but no orderId was returned",
        };
      }

      console.log(
        `[Execution] WEEX TP CREATED SUCCESSFULLY`
      );

      console.log(
        `[Execution] TP Order ID=${orderId}`
      );

      return {
        success:
          true,

        simulated:
          false,

        executed:
          true,

        symbol:
          normalizedSymbol,

        positionSide:
          normalizedPositionSide,

        planType:
          "TAKE_PROFIT",

        triggerPrice:
          numericTriggerPrice,

        triggerPriceType:
          normalizedTriggerType,

        executePrice:
          0,

        quantity:
          "0",

        clientAlgoId:
          algoId,

        orderId:
          orderId,

        fullPosition:
          true,

        raw:
          response,
      };

    } catch (error) {
      console.error(
        `[Execution] PLACE TAKE PROFIT ERROR ${normalizedSymbol} ${normalizedPositionSide}: ${error.message}`
      );

      return {
        success:
          false,

        simulated:
          false,

        executed:
          false,

        symbol:
          normalizedSymbol,

        positionSide:
          normalizedPositionSide,

        planType:
          "TAKE_PROFIT",

        triggerPrice:
          numericTriggerPrice,

        triggerPriceType:
          normalizedTriggerType,

        executePrice:
          0,

        quantity:
          "0",

        clientAlgoId:
          algoId,

        error:
          error.message,

        reason:
          "WEEX TP placement request failed",
      };
    }
  }


  // ============================================================
  // MODIFY FULL POSITION STOP LOSS
  // WEEX V3 LIVE
  //
  // POST /capi/v3/modifyTpSlOrder
  // ============================================================

  async modifyFullPositionStopLoss({
    orderId,
    symbol,
    positionSide,
    triggerPrice,
    triggerPriceType = "MARK_PRICE",
  }) {
    const normalizedSymbol =
      String(symbol)
        .trim()
        .toUpperCase();

    const normalizedPositionSide =
      String(positionSide)
        .trim()
        .toUpperCase();

    const numericTriggerPrice =
      Number(triggerPrice);

    const numericOrderId =
      String(orderId || "").trim();


    if (!numericOrderId) {
      throw new Error(
        "Modify stop loss requires an orderId"
      );
    }


    if (!normalizedSymbol) {
      throw new Error(
        "Modify stop loss requires a symbol"
      );
    }


    if (
      normalizedPositionSide !==
        "LONG" &&
      normalizedPositionSide !==
        "SHORT"
    ) {
      throw new Error(
        "Modify stop loss positionSide must be LONG or SHORT"
      );
    }


    if (
      !Number.isFinite(
        numericTriggerPrice
      ) ||
      numericTriggerPrice <= 0
    ) {
      throw new Error(
        "Modify stop loss requires a valid trigger price"
      );
    }


    const normalizedTriggerType =
      String(
        triggerPriceType
      )
        .trim()
        .toUpperCase();


    if (
      normalizedTriggerType !==
        "MARK_PRICE" &&
      normalizedTriggerType !==
        "CONTRACT_PRICE"
    ) {
      throw new Error(
        "Modify stop loss triggerPriceType must be MARK_PRICE or CONTRACT_PRICE"
      );
    }


    const body = {
      orderId:
        numericOrderId,

      triggerPrice:
        String(numericTriggerPrice),

      executePrice:
        "0",

      triggerPriceType:
        normalizedTriggerType,
    };


    const bodyString =
      JSON.stringify(body);


    console.log(
      `[Execution] MODIFY FULL-POSITION STOP LOSS`
    );

    console.log(
      `[Execution] Symbol=${normalizedSymbol}`
    );

    console.log(
      `[Execution] Position Side=${normalizedPositionSide}`
    );

    console.log(
      `[Execution] SL Order ID=${numericOrderId}`
    );

    console.log(
      `[Execution] New Trigger Price=${numericTriggerPrice}`
    );

    console.log(
      `[Execution] Trigger Type=${normalizedTriggerType}`
    );

    console.log(
      `[Execution] Execute Price=0 (MARKET)`
    );


    if (!this.authEnabled) {
      console.log(
        `[Execution] WEEX authentication is not configured`
      );

      return {
        success:
          false,

        simulated:
          true,

        executed:
          false,

        symbol:
          normalizedSymbol,

        positionSide:
          normalizedPositionSide,

        orderId:
          numericOrderId,

        triggerPrice:
          numericTriggerPrice,

        triggerPriceType:
          normalizedTriggerType,

        executePrice:
          0,

        reason:
          "WEEX authentication is not configured",
      };
    }


    try {
      const response =
        await this.request(
          "/capi/v3/modifyTpSlOrder",
          {
            method:
              "POST",

            bodyString:
              bodyString,

            auth:
              true,
          }
        );


      console.log(
        `[Execution] WEEX SL MODIFY RESPONSE`
      );

      console.log(
        response
      );


      if (
        !response ||
        response.success !== true
      ) {
        return {
          success:
            false,

          simulated:
            false,

          executed:
            false,

          symbol:
            normalizedSymbol,

          positionSide:
            normalizedPositionSide,

          orderId:
            numericOrderId,

          triggerPrice:
            numericTriggerPrice,

          triggerPriceType:
            normalizedTriggerType,

          executePrice:
            0,

          raw:
            response,

          reason:
            response?.errorMessage ||
            response?.msg ||
            response?.message ||
            "WEEX rejected SL modification",
        };
      }


      console.log(
        `[Execution] WEEX SL MODIFIED SUCCESSFULLY`
      );


      return {
        success:
          true,

        simulated:
          false,

        executed:
          true,

        symbol:
          normalizedSymbol,

        positionSide:
          normalizedPositionSide,

        orderId:
          numericOrderId,

        triggerPrice:
          numericTriggerPrice,

        triggerPriceType:
          normalizedTriggerType,

        executePrice:
          0,

        raw:
          response,
      };

    } catch (error) {
      console.error(
        `[Execution] MODIFY STOP LOSS ERROR ${normalizedSymbol} ${normalizedPositionSide}: ${error.message}`
      );

      return {
        success:
          false,

        simulated:
          false,

        executed:
          false,

        symbol:
          normalizedSymbol,

        positionSide:
          normalizedPositionSide,

        orderId:
          numericOrderId,

        triggerPrice:
          numericTriggerPrice,

        triggerPriceType:
          normalizedTriggerType,

        executePrice:
          0,

        error:
          error.message,

        reason:
          "WEEX SL modification request failed",
      };
    }
  }


  // ============================================================
  // MODIFY FULL POSITION TAKE PROFIT
  // WEEX V3
  //
  // POST /capi/v3/modifyTpSlOrder
  // ============================================================

  async modifyFullPositionTakeProfit({
    orderId,
    symbol,
    positionSide,
    triggerPrice,
    triggerPriceType = "MARK_PRICE",
  }) {
    const normalizedSymbol =
      String(symbol)
        .trim()
        .toUpperCase();

    const normalizedPositionSide =
      String(positionSide)
        .trim()
        .toUpperCase();

    const numericTriggerPrice =
      Number(triggerPrice);

    const numericOrderId =
      String(orderId || "").trim();


    if (!numericOrderId) {
      throw new Error(
        "Modify take profit requires an orderId"
      );
    }


    if (!normalizedSymbol) {
      throw new Error(
        "Modify take profit requires a symbol"
      );
    }


    if (
      normalizedPositionSide !==
        "LONG" &&
      normalizedPositionSide !==
        "SHORT"
    ) {
      throw new Error(
        "Modify take profit positionSide must be LONG or SHORT"
      );
    }


    if (
      !Number.isFinite(
        numericTriggerPrice
      ) ||
      numericTriggerPrice <= 0
    ) {
      throw new Error(
        "Modify take profit requires a valid trigger price"
      );
    }


    const normalizedTriggerType =
      String(
        triggerPriceType
      )
        .trim()
        .toUpperCase();


    if (
      normalizedTriggerType !==
        "MARK_PRICE" &&
      normalizedTriggerType !==
        "CONTRACT_PRICE"
    ) {
      throw new Error(
        "Modify take profit triggerPriceType must be MARK_PRICE or CONTRACT_PRICE"
      );
    }


    const body = {
      orderId:
        numericOrderId,

      triggerPrice:
        String(numericTriggerPrice),

      executePrice:
        "0",

      triggerPriceType:
        normalizedTriggerType,
    };


    const bodyString =
      JSON.stringify(body);


    console.log(
      `[Execution] MODIFY FULL-POSITION TAKE PROFIT`
    );

    console.log(
      `[Execution] Symbol=${normalizedSymbol}`
    );

    console.log(
      `[Execution] Position Side=${normalizedPositionSide}`
    );

    console.log(
      `[Execution] TP Order ID=${numericOrderId}`
    );

    console.log(
      `[Execution] New Trigger Price=${numericTriggerPrice}`
    );

    console.log(
      `[Execution] Trigger Type=${normalizedTriggerType}`
    );

    console.log(
      `[Execution] Execute Price=0 (MARKET)`
    );


    if (!this.authEnabled) {
      console.log(
        `[Execution] WEEX authentication is not configured`
      );

      return {
        success:
          false,

        simulated:
          true,

        executed:
          false,

        symbol:
          normalizedSymbol,

        positionSide:
          normalizedPositionSide,

        orderId:
          numericOrderId,

        triggerPrice:
          numericTriggerPrice,

        triggerPriceType:
          normalizedTriggerType,

        executePrice:
          0,

        reason:
          "WEEX authentication is not configured",
      };
    }


    try {
      const response =
        await this.request(
          "/capi/v3/modifyTpSlOrder",
          {
            method:
              "POST",

            bodyString:
              bodyString,

            auth:
              true,
          }
        );


      console.log(
        `[Execution] WEEX TP MODIFY RESPONSE`
      );

      console.log(
        response
      );


      if (
        !response ||
        response.success !== true
      ) {
        return {
          success:
            false,

          simulated:
            false,

          executed:
            false,

          symbol:
            normalizedSymbol,

          positionSide:
            normalizedPositionSide,

          orderId:
            numericOrderId,

          triggerPrice:
            numericTriggerPrice,

          triggerPriceType:
            normalizedTriggerType,

          executePrice:
            0,

          raw:
            response,

          reason:
            response?.errorMessage ||
            response?.msg ||
            response?.message ||
            "WEEX rejected TP modification",
        };
      }


      console.log(
        `[Execution] WEEX TP MODIFIED SUCCESSFULLY`
      );


      return {
        success:
          true,

        simulated:
          false,

        executed:
          true,

        symbol:
          normalizedSymbol,

        positionSide:
          normalizedPositionSide,

        orderId:
          numericOrderId,

        triggerPrice:
          numericTriggerPrice,

        triggerPriceType:
          normalizedTriggerType,

        executePrice:
          0,

        raw:
          response,
      };

    } catch (error) {
      console.error(
        `[Execution] MODIFY TAKE PROFIT ERROR ${normalizedSymbol} ${normalizedPositionSide}: ${error.message}`
      );

      return {
        success:
          false,

        simulated:
          false,

        executed:
          false,

        symbol:
          normalizedSymbol,

        positionSide:
          normalizedPositionSide,

        orderId:
          numericOrderId,

        triggerPrice:
          numericTriggerPrice,

        triggerPriceType:
          normalizedTriggerType,

        executePrice:
          0,

        error:
          error.message,

        reason:
          "WEEX TP modification request failed",
      };
    }
  }


  // ============================================================
  // DEBUG FULL POSITION STOP LOSS
  // TEMPORARY TEST ONLY
  //
  // IMPORTANT:
  // This method is INSIDE the class.
  // ============================================================

  async debugPlaceStopLoss({
    symbol,
    positionSide,
    triggerPrice,
  }) {
    const normalizedSymbol =
      String(symbol)
        .trim()
        .toUpperCase();

    const normalizedPositionSide =
      String(positionSide)
        .trim()
        .toUpperCase();

    const numericTriggerPrice =
      Number(triggerPrice);

    if (!normalizedSymbol) {
      throw new Error(
        "Debug SL requires a symbol"
      );
    }

    if (
      normalizedPositionSide !==
        "LONG" &&
      normalizedPositionSide !==
        "SHORT"
    ) {
      throw new Error(
        "Debug SL positionSide must be LONG or SHORT"
      );
    }

    if (
      !Number.isFinite(
        numericTriggerPrice
      ) ||
      numericTriggerPrice <= 0
    ) {
      throw new Error(
        "Debug SL requires a valid trigger price"
      );
    }

    const clientAlgoId =
      `debug-sl-${Date.now()}`;

    const body = {
      symbol:
        normalizedSymbol,

      clientAlgoId:
        clientAlgoId,

      planType:
        "STOP_LOSS",

      triggerPrice:
        String(numericTriggerPrice),

      executePrice:
        "0",

      quantity:
        "0",

      positionSide:
        normalizedPositionSide,

      triggerPriceType:
        "MARK_PRICE",

      reduceOnly:
        false,
    };

    const bodyString =
      JSON.stringify(body);

    console.log("");

    console.log(
      "============================================================"
    );

    console.log(
      "[DEBUG] DIRECT WEEX SL TEST"
    );

    console.log(
      "============================================================"
    );

    console.log(
      `[DEBUG] Symbol=${normalizedSymbol}`
    );

    console.log(
      `[DEBUG] Position Side=${normalizedPositionSide}`
    );

    console.log(
      `[DEBUG] Trigger Price=${numericTriggerPrice}`
    );

    console.log(
      `[DEBUG] Client Algo ID=${clientAlgoId}`
    );

    console.log(
      `[DEBUG] Request Body=${bodyString}`
    );

    try {
      const response =
        await this.request(
          "/capi/v3/placeTpSlOrder",
          {
            method:
              "POST",

            bodyString:
              bodyString,

            auth:
              true,
          }
        );

      console.log(
        "[DEBUG] WEEX RAW SL RESPONSE"
      );

      console.log(
        JSON.stringify(
          response,
          null,
          2
        )
      );

      console.log(
        "============================================================"
      );

      console.log(
        "[DEBUG] DIRECT WEEX SL TEST COMPLETE"
      );

      console.log(
        "============================================================"
      );

      console.log("");

      return response;

    } catch (error) {
      console.error(
        `[DEBUG] DIRECT WEEX SL TEST ERROR: ${error.message}`
      );

      console.log(
        "============================================================"
      );

      console.log(
        "[DEBUG] DIRECT WEEX SL TEST FAILED"
      );

      console.log(
        "============================================================"
      );

      console.log("");

      return {
        success:
          false,

        error:
          error.message,
      };
    }
  }


  // ============================================================
  // CLOSE POSITION
  // CURRENTLY SIMULATED
  // ============================================================

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
      normalizedDirection !==
        "LONG" &&
      normalizedDirection !==
        "SHORT"
    ) {
      throw new Error(
        "Close position direction must be LONG or SHORT"
      );
    }


    if (
      !Number.isFinite(
        numericQuantity
      ) ||
      numericQuantity <= 0
    ) {
      throw new Error(
        "Close position requires a valid quantity"
      );
    }


    console.log(
      `[Execution] SIMULATED CLOSE ${normalizedDirection} ${normalizedSymbol} quantity=${numericQuantity}`
    );


    return {
      success:
        false,

      simulated:
        true,

      executed:
        false,

      symbol:
        normalizedSymbol,

      direction:
        normalizedDirection,

      quantity:
        numericQuantity,

      reason:
        "WEEX close execution is not connected yet",
    };
  }
}


module.exports =
  WeexExecution;