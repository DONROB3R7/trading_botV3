const OrderBookModule =
  require("../modules/orderBook");

const {
  getOrderBook,
} = require("../market/orderBookData");

const {
  getTicker,
} = require("../market/marketData");

const WeexExecution =
  require("../execution/weexExecution");

const {
  calculateOrder,
} = require("../execution/orderCalculator");


class AdvancedBot {
  constructor(config = {}) {

    // ============================================================
    // SAVE CONFIG
    // ============================================================

    this.config =
      config;

    this.id =
      config.id ||
      `advanced_${Date.now()}`;

    this.botType =
      "ADVANCED";

    this.symbol =
      String(config.symbol || "")
        .trim()
        .toUpperCase();

    this.direction =
      String(config.direction || "LONG")
        .trim()
        .toUpperCase();

    this.entryModel =
      "ORDERBOOK";


    // ============================================================
    // GLOBAL POSITION SETTINGS
    // ============================================================

    this.marginUSDT =
      Number(config.marginUSDT ?? 0.5);

    this.leverage =
      Number(config.leverage ?? 10);

    this.orderCalculation =
      null;

    this.execution =
      new WeexExecution({
        apiKey:
          process.env.WEEX_API_KEY,

        secretKey:
          process.env.WEEX_API_SECRET,

        passphrase:
          process.env.WEEX_API_PASSPHRASE,
      });


    // ============================================================
    // ORDER BOOK CONFIGURATION
    // ============================================================

    this.orderBookConfig = {
      trendDepth:
        200,

      entryDepths: [
        15,
        20,
        30,
        60,
      ],

      longMinImbalance:
        Number(
          config.longMinImbalance ?? 0.005
        ),

      shortMaxImbalance:
        Number(
          config.shortMaxImbalance ?? -0.005
        ),

      minBidAskRatio:
        Number(
          config.minBidAskRatio ?? 0.90
        ),

      minAskBidRatio:
        Number(
          config.minAskBidRatio ?? 0.90
        ),

      counterTrendRequired:
        Math.min(
          4,
          Math.max(
            1,
            Number(
              config.counterTrendRequired ?? 3
            )
          )
        ),
    };


    // ============================================================
    // ORDER BOOK MODULE
    // ============================================================

    this.orderBook =
      new OrderBookModule(
        this.orderBookConfig
      );


    // ============================================================
    // CYCLE CONFIGURATION
    // ============================================================

    this.cycleMinutes =
      Math.max(
        1,
        Number(
          config.cycleMinutes ?? 10
        )
      );

    this.cycleIntervalMs =
      Math.max(
        1000,
        Number(
          config.cycleIntervalMs ?? 60000
        )
      );

    this.cycleTriggerMinutes =
      Math.min(
        this.cycleMinutes,
        Math.max(
          1,
          Number(
            config.cycleTriggerMinutes ?? 3
          )
        )
      );


    // ============================================================
    // PYRAMIDING
    // ============================================================

    this.maxEntries =
      Math.min(
        3,
        Math.max(
          1,
          Number(
            config.maxEntries ?? 3
          )
        )
      );


    // ============================================================
    // TP / SL SETTINGS
    // ============================================================

    this.tpPercent =
      Number(
        config.tpPercent ?? 1
      );

    this.slPercent =
      Number(
        config.slPercent ?? 0.8
      );

    this.dynamicSlPercent =
      Number(
        config.dynamicSlPercent ?? 3
      );


    // ============================================================
    // TP POSITION SYNC DELAY
    // ============================================================

    this.tpPositionSyncDelayMs =
      Math.max(
        0,
        Number(
          config.tpPositionSyncDelayMs ??
          (
            Number(
              config.tpPositionSyncDelaySeconds ??
              10
            ) * 1000
          )
        )
      );


    // ============================================================
    // ENTRY #1 PROTECTION TIMING
    // ============================================================

    this.protectionDelayMs =
      Math.max(
        0,
        Number(
          config.protectionDelayMs ??
          30000
        )
      );

    this.protectionTimeoutMs =
      Math.max(
        this.protectionDelayMs,
        Number(
          config.protectionTimeoutMs ??
          60000
        )
      );

    this.protectionPollIntervalMs =
      Math.max(
        250,
        Number(
          config.protectionPollIntervalMs ??
          1000
        )
      );

    this.protectionInProgress =
      false;


    // ============================================================
    // TP SYNC RUNTIME
    // ============================================================

    this.tpSyncTimer =
      null;

    this.tpSyncInProgress =
      false;

    this.tpSyncNumber =
      0;


    // ============================================================
    // POSITION / SL / TP STATE
    // ============================================================

    this.positionState = {
      side:
        null,

      entryPrice:
        null,

      averageEntryPrice:
        null,

      contracts:
        0,

      initialSLPrice:
        null,

      currentSLPrice:
        null,

      tpPrice:
        null,

      tpOrderId:
        null,

      slOrderId:
        null,

      winningGapPrice:
        null,

      winningGapPercent:
        null,

      tradeNumber:
        0,

      isWinner:
        false,

      lastExitPrice:
        null,

      lastExitReason:
        null,

      lastPositionSyncAt:
        null,

      lastPositionSyncError:
        null,
    };


    // ============================================================
    // LOCAL ENTRY HISTORY
    // ============================================================

    this.positionEntries =
      [];


    // ============================================================
    // PRICE KILL ZONE
    // ============================================================

    this.killZone = {
      enabled:
        Boolean(
          config.killZoneEnabled ?? false
        ),

      low:
        config.killZoneLow !== undefined &&
        config.killZoneLow !== null &&
        config.killZoneLow !== ""
          ? Number(config.killZoneLow)
          : null,

      high:
        config.killZoneHigh !== undefined &&
        config.killZoneHigh !== null &&
        config.killZoneHigh !== ""
          ? Number(config.killZoneHigh)
          : null,
    };

    this.killZoneCheckIntervalMs =
      Math.max(
        1000,
        Number(
          config.killZoneCheckIntervalMs ?? 5000
        )
      );


    // ============================================================
    // TRIGGER LINE
    // ============================================================

    this.triggerLine = {
      enabled:
        Boolean(
          config.triggerLineEnabled ?? false
        ),

      price:
        config.triggerLinePrice !== undefined &&
        config.triggerLinePrice !== null &&
        config.triggerLinePrice !== ""
          ? Number(config.triggerLinePrice)
          : null,

      armed:
        Boolean(
          config.triggerLineArmed ?? false
        ),

      triggeredAt:
        config.triggerLineTriggeredAt ??
        null,

      initialized:
        false,

      waitingForReset:
        false,

      previousPrice:
        null,

      initializing:
        false,

      initializedAt:
        null,
    };


    // ============================================================
    // TRIGGER LINE CHECK INTERVAL
    // ============================================================

    this.triggerLineCheckIntervalMs =
      Math.max(
        1000,
        Number(
          config.triggerLineCheckIntervalMs ?? 1000
        )
      );


    // ============================================================
    // RUNTIME STATE
    // ============================================================

    this.status =
      "STOPPED";

    this.position =
      null;

    this.entryCount =
      0;

    this.entrySignals =
      [];

    this.logs =
      [];

    this.lastScanAt =
      null;

    this.lastDecision =
      "NEUTRAL";

    this.lastPrice =
      null;

    this.lastAnalysis =
      null;


    // ============================================================
    // CYCLE STATE
    // ============================================================

    this.cycleNumber =
      1;

    this.cycleStartedAt =
      null;

    this.cycleScans =
      0;

    this.cycleTriggerCount =
      0;

    this.cycleDecision =
      "NEUTRAL";

    this.cycleDecisionHistory =
      [];

    this.completedCycleHistory =
      [];


    // ============================================================
    // TIMERS
    // ============================================================

    this.interval =
      null;

    this.killZoneInterval =
      null;

    this.triggerLineInterval =
      null;
  }


  // ============================================================
  // LOGGING
  // ============================================================

  log(message) {
    const time =
      new Date().toISOString();

    const entry =
      `[${time}] ${message}`;

    this.logs.push(entry);

    if (this.logs.length > 200) {
      this.logs.shift();
    }

    console.log(
      `[AdvancedBot:${this.symbol}] ${message}`
    );
  }


  // ============================================================
  // SLEEP
  // ============================================================

  sleep(ms) {
    return new Promise(
      (resolve) => {
        setTimeout(
          resolve,
          ms
        );
      }
    );
  }


  // ============================================================
  // ORDER CALCULATION
  // ============================================================

  async calculateOrderSize() {
    this.orderCalculation =
      await calculateOrder(
        this.symbol,
        this.marginUSDT,
        this.leverage
      );

    this.log(
      `Order Size | ` +
      `margin=${this.orderCalculation.marginUSDT} USDT | ` +
      `leverage=${this.orderCalculation.leverage}x | ` +
      `contracts=${this.orderCalculation.contracts} | ` +
      `notional=${this.orderCalculation.actualNotional.toFixed(4)} USDT | ` +
      `estimatedMargin=${this.orderCalculation.estimatedMargin.toFixed(4)} USDT`
    );

    if (
      this.orderCalculation.marginExceeded
    ) {
      this.log(
        `Order Margin Warning | ` +
        `Configured=${this.orderCalculation.marginUSDT.toFixed(4)} USDT | ` +
        `Required=${this.orderCalculation.estimatedMargin.toFixed(4)} USDT | ` +
        `Excess=${this.orderCalculation.marginDifference.toFixed(4)} USDT | ` +
        `MinimumRequired=${this.orderCalculation.minimumRequiredMargin.toFixed(4)} USDT | ` +
        `Status=${this.orderCalculation.marginStatus}`
      );

    } else {
      this.log(
        `Order Margin OK | ` +
        `Configured=${this.orderCalculation.marginUSDT.toFixed(4)} USDT | ` +
        `Required=${this.orderCalculation.estimatedMargin.toFixed(4)} USDT | ` +
        `Status=${this.orderCalculation.marginStatus}`
      );
    }

    return this.orderCalculation;
  }


  // ============================================================
  // INITIAL SL
  // ============================================================

  calculateInitialSL(entryPrice) {
    const entry =
      Number(entryPrice);

    const percent =
      Number(this.slPercent);

    if (
      !Number.isFinite(entry) ||
      entry <= 0
    ) {
      return null;
    }

    if (
      !Number.isFinite(percent) ||
      percent <= 0
    ) {
      return null;
    }

    if (
      this.direction === "LONG"
    ) {
      return (
        entry *
        (1 - percent / 100)
      );
    }

    if (
      this.direction === "SHORT"
    ) {
      return (
        entry *
        (1 + percent / 100)
      );
    }

    return null;
  }


  // ============================================================
  // TP FROM AVERAGE
  // ============================================================

  calculateTP(entryPrice) {
    const entry =
      Number(entryPrice);

    const percent =
      Number(this.tpPercent);

    if (
      !Number.isFinite(entry) ||
      entry <= 0
    ) {
      return null;
    }

    if (
      !Number.isFinite(percent) ||
      percent <= 0
    ) {
      return null;
    }

    if (
      this.direction === "LONG"
    ) {
      return (
        entry *
        (1 + percent / 100)
      );
    }

    if (
      this.direction === "SHORT"
    ) {
      return (
        entry *
        (1 - percent / 100)
      );
    }

    return null;
  }


  // ============================================================
  // EXTRACT TP / ALGO ORDER ID
  // ============================================================

  extractTPOrderId(result) {
    if (!result) {
      return null;
    }

    const candidates = [
      result.orderId,
      result.algoId,
      result.data?.orderId,
      result.data?.algoId,
      result.response?.orderId,
      result.response?.algoId,
      result.response?.data?.orderId,
      result.response?.data?.algoId,
    ];

    for (
      const candidate of candidates
    ) {
      if (
        candidate !== undefined &&
        candidate !== null &&
        String(candidate).trim() !== ""
      ) {
        return String(candidate).trim();
      }
    }

    return null;
  }


  // ============================================================
  // RECORD POSITION ENTRY
  // ============================================================

  recordPositionEntry({
    entryPrice,
    contracts,
    result,
  } = {}) {
    const price =
      Number(entryPrice);

    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {
      this.log(
        "Position entry recorded without valid entry price"
      );

      return;
    }

    const numericContracts =
      Number(
        contracts ??
        this.orderCalculation?.contracts ??
        0
      );


    // ==========================================================
    // FIRST ENTRY
    // ==========================================================

    if (
      this.entryCount === 1
    ) {
      const calculatedSL =
        this.calculateInitialSL(
          price
        );

      this.positionState.side =
        this.direction;

      this.positionState.entryPrice =
        price;

      this.positionState.averageEntryPrice =
        price;

      this.positionState.contracts =
        Number.isFinite(numericContracts)
          ? numericContracts
          : 0;

      this.positionState.initialSLPrice =
        calculatedSL;

      this.positionState.currentSLPrice =
        calculatedSL;

      this.positionState.tpPrice =
        this.calculateTP(
          price
        );

      this.positionState.tpOrderId =
        null;

      this.positionState.slOrderId =
        null;

      this.positionState.tradeNumber =
        1;

      this.positionState.isWinner =
        false;

      this.positionState.lastExitPrice =
        null;

      this.positionState.lastExitReason =
        null;

      this.position =
        {
          symbol:
            this.symbol,

          side:
            this.direction,

          entryPrice:
            price,

          averageEntryPrice:
            price,

          contracts:
            this.positionState.contracts,

          slPrice:
            calculatedSL,

          tpPrice:
            this.positionState.tpPrice,

          tpOrderId:
            null,

          slOrderId:
            null,

          openedAt:
            new Date().toISOString(),

          result:
            result || null,
        };

      this.log(
        `FIRST POSITION | ` +
        `${this.direction} | ` +
        `Entry=${price} | ` +
        `Initial SL=${calculatedSL ?? "NONE"} | ` +
        `TP=${this.positionState.tpPrice ?? "WAITING"}`
      );
    }


    // ==========================================================
    // PYRAMID ENTRY
    // ==========================================================

    else {
      this.positionState.contracts +=
        Number.isFinite(numericContracts)
          ? numericContracts
          : 0;

      this.positionState.tradeNumber =
        this.entryCount;

      this.log(
        `PYRAMID ENTRY ${this.entryCount} | ` +
        `Entry=${price} | ` +
        `NO NEW SL | ` +
        `Existing SL=${this.positionState.currentSLPrice ?? "NONE"} | ` +
        `Existing TP Order=${this.positionState.tpOrderId ?? "NONE"}`
      );
    }


    // ==========================================================
    // STORE LOCAL ENTRY
    // ==========================================================

    this.positionEntries.push({
      number:
        this.entryCount,

      time:
        new Date().toISOString(),

      price:
        price,

      contracts:
        numericContracts,

      direction:
        this.direction,
    });


    if (
      this.positionEntries.length >
      10
    ) {
      this.positionEntries.shift();
    }


    if (
      this.position
    ) {
      this.position.contracts =
        this.positionState.contracts;

      this.position.slPrice =
        this.positionState.currentSLPrice;

      this.position.tpPrice =
        this.positionState.tpPrice;

      this.position.tpOrderId =
        this.positionState.tpOrderId;

      this.position.slOrderId =
        this.positionState.slOrderId;
    }
  }


  // ============================================================
  // READ REAL WEEX POSITION
  // ============================================================

  async getRealWEEXPosition() {
    const position =
      await this.execution.getPosition({
        symbol:
          this.symbol,

        positionSide:
          this.direction,
      });

    if (
      !position ||
      position.connected !== true
    ) {
      return {
        found:
          false,

        position:
          position || null,

        reason:
          position?.reason ||
          "WEEX position data unavailable",
      };
    }

    if (
      position.authenticated === false
    ) {
      return {
        found:
          false,

        position:
          position,

        reason:
          "WEEX authentication failed",
      };
    }

    const size =
      Number(
        position.size ?? 0
      );

    const hasPosition =
      position.hasPosition === true ||
      (
        Number.isFinite(size) &&
        size > 0
      );

    if (!hasPosition) {
      return {
        found:
          false,

        position:
          position,

        reason:
          "WEEX reports no open position",
      };
    }

    return {
      found:
        true,

      position:
        position,

      size:
        size,
    };
  }


  // ============================================================
  // SYNC REAL POSITION INTO LOCAL STATE
  // ============================================================

  syncRealPositionState(
    position
  ) {
    if (!position) {
      return null;
    }

    const realSize =
      Number(
        position.size
      );

    if (
      Number.isFinite(realSize) &&
      realSize > 0
    ) {
      this.positionState.contracts =
        realSize;
    }

    let averageEntry =
      Number(
        position.averageEntryPrice ??
        position.avgEntryPrice ??
        position.entryPrice ??
        NaN
      );


    // ==========================================================
    // FALLBACK
    // ==========================================================

    if (
      !Number.isFinite(averageEntry) ||
      averageEntry <= 0
    ) {
      if (
        typeof this.execution.calculateAverageEntry ===
        "function"
      ) {
        averageEntry =
          this.execution.calculateAverageEntry({
            openValue:
              position.openValue,

            size:
              position.size,
          });
      }
    }


    if (
      !Number.isFinite(averageEntry) ||
      averageEntry <= 0
    ) {
      throw new Error(
        "WEEX position exists but average entry price is invalid"
      );
    }


    this.positionState.averageEntryPrice =
      averageEntry;

    this.positionState.lastPositionSyncAt =
      new Date().toISOString();

    this.positionState.lastPositionSyncError =
      null;


    if (
      this.position
    ) {
      this.position.averageEntryPrice =
        averageEntry;

      this.position.contracts =
        this.positionState.contracts;

      this.position.slPrice =
        this.positionState.currentSLPrice;

      this.position.tpPrice =
        this.positionState.tpPrice;

      this.position.tpOrderId =
        this.positionState.tpOrderId;

      this.position.slOrderId =
        this.positionState.slOrderId;
    }


    return {
      averageEntryPrice:
        averageEntry,

      size:
        this.positionState.contracts,

      openValue:
        Number(
          position.openValue ?? 0
        ),
    };
  }


  // ============================================================
  // ENTRY #1 PROTECTION
  //
  // OPEN
  // ↓
  // WAIT
  // ↓
  // POLL WEEX
  // ↓
  // REAL POSITION FOUND
  // ↓
  // REAL AVERAGE ENTRY
  // ↓
  // REAL POSITION SIZE
  // ↓
  // RECALCULATE TP
  // ↓
  // SL
  // ↓
  // TP
  // ============================================================

  async protectEntryOne() {
    if (
      this.protectionInProgress
    ) {
      this.log(
        "ENTRY #1 PROTECTION | Already running | Skipping duplicate protection process"
      );

      return false;
    }

    this.protectionInProgress =
      true;


    try {
      // ========================================================
      // BASIC CHECK
      // ========================================================

      if (
        this.status !== "RUNNING"
      ) {
        this.log(
          "ENTRY #1 PROTECTION | Bot no longer RUNNING | Aborted"
        );

        return false;
      }

      if (
        this.entryCount !== 1
      ) {
        this.log(
          `ENTRY #1 PROTECTION | Entry count is ${this.entryCount} | Aborted`
        );

        return false;
      }


      // ========================================================
      // KILL ZONE BEFORE WAIT
      // ========================================================

      if (
        this.killZone.enabled
      ) {
        const killed =
          await this.checkPriceKillZone();

        if (killed) {
          this.log(
            "ENTRY #1 PROTECTION | Kill Zone triggered before protection"
          );

          return false;
        }
      }


      // ========================================================
      // SHARED DELAY
      // ========================================================

      this.log(
        `ENTRY #1 PROTECTION | ` +
        `Waiting ${(this.protectionDelayMs / 1000).toFixed(0)}s for WEEX position registration...`
      );

      const waitStarted =
        Date.now();

      while (
        Date.now() - waitStarted <
        this.protectionDelayMs
      ) {
        if (
          this.status !== "RUNNING"
        ) {
          this.log(
            "ENTRY #1 PROTECTION | Bot stopped during initial delay"
          );

          return false;
        }

        if (
          this.killZone.enabled
        ) {
          const killed =
            await this.checkPriceKillZone();

          if (killed) {
            this.log(
              "ENTRY #1 PROTECTION | Kill Zone triggered during initial delay"
            );

            return false;
          }
        }

        const remaining =
          this.protectionDelayMs -
          (
            Date.now() -
            waitStarted
          );

        await this.sleep(
          Math.min(
            1000,
            Math.max(
              100,
              remaining
            )
          )
        );
      }


      // ========================================================
      // POLL WEEX
      // ========================================================

      const protectionStarted =
        Date.now();

      let realPosition =
        null;

      while (
        Date.now() -
        protectionStarted <=
        (
          this.protectionTimeoutMs -
          this.protectionDelayMs
        )
      ) {
        if (
          this.status !== "RUNNING"
        ) {
          this.log(
            "ENTRY #1 PROTECTION | Bot stopped while waiting for WEEX position"
          );

          return false;
        }


        // ------------------------------------------------------
        // KILL ZONE
        // ------------------------------------------------------

        if (
          this.killZone.enabled
        ) {
          const killed =
            await this.checkPriceKillZone();

          if (killed) {
            this.log(
              "ENTRY #1 PROTECTION | Kill Zone triggered while waiting for WEEX position"
            );

            return false;
          }
        }


        // ------------------------------------------------------
        // QUERY WEEX
        // ------------------------------------------------------

        try {
          const result =
            await this.getRealWEEXPosition();

          if (
            result.found
          ) {
            realPosition =
              result.position;

            this.log(
              `ENTRY #1 PROTECTION | REAL WEEX POSITION FOUND | ` +
              `Size=${result.size}`
            );

            break;
          }

          this.log(
            `ENTRY #1 PROTECTION | ` +
            `WEEX position not visible yet | ` +
            `${result.reason}`
          );

        } catch (error) {
          this.log(
            `ENTRY #1 PROTECTION | ` +
            `Position check error: ${error.message}`
          );
        }


        await this.sleep(
          this.protectionPollIntervalMs
        );
      }


      // ========================================================
      // TIMEOUT
      // ========================================================

      if (
        !realPosition
      ) {
        this.positionState.lastPositionSyncAt =
          new Date().toISOString();

        this.positionState.lastPositionSyncError =
          `WEEX position was not visible within ${this.protectionTimeoutMs / 1000}s`;

        this.log(
          `ENTRY #1 PROTECTION FAILED | ` +
          `WEEX position not found within ${this.protectionTimeoutMs / 1000}s`
        );

        return false;
      }


      // ========================================================
      // SYNC REAL POSITION
      // ========================================================

      const realState =
        this.syncRealPositionState(
          realPosition
        );


      this.log(
        `ENTRY #1 PROTECTION | ` +
        `REAL POSITION SYNCED | ` +
        `Size=${realState.size} | ` +
        `Average Entry=${realState.averageEntryPrice}`
      );


      // ========================================================
      // IMPORTANT REAL QUANTITY CHECK
      // ========================================================

      const realQuantity =
        Number(
          realState.size
        );

      if (
        !Number.isFinite(realQuantity) ||
        realQuantity <= 0
      ) {
        this.log(
          `ENTRY #1 PROTECTION FAILED | ` +
          `Invalid REAL WEEX quantity=${realState.size}`
        );

        return false;
      }

      this.log(
        `ENTRY #1 PROTECTION | ` +
        `REAL WEEX PROTECTION QUANTITY=${realQuantity}`
      );


      // ========================================================
      // RECALCULATE TP FROM REAL WEEX AVERAGE
      // ========================================================

      const realAverage =
        realState.averageEntryPrice;

      const realTP =
        this.calculateTP(
          realAverage
        );

      if (
        !Number.isFinite(realTP) ||
        realTP <= 0
      ) {
        throw new Error(
          `Invalid TP calculated from real average entry ${realAverage}`
        );
      }

      this.positionState.tpPrice =
        realTP;

      if (
        this.position
      ) {
        this.position.averageEntryPrice =
          realAverage;

        this.position.tpPrice =
          realTP;

        this.position.contracts =
          realQuantity;
      }


      this.log(
        `ENTRY #1 PROTECTION | ` +
        `REAL AVERAGE=${realAverage} | ` +
        `REAL TP=${realTP}`
      );


      // ========================================================
      // SL FIRST
      // ========================================================

      if (
        !Number.isFinite(
          this.positionState.currentSLPrice
        ) ||
        this.positionState.currentSLPrice <= 0
      ) {
        this.log(
          "ENTRY #1 PROTECTION | SL INVALID | TP will NOT be placed without valid SL"
        );

        return false;
      }


      if (
        typeof this.execution.placeFullPositionStopLoss !==
        "function"
      ) {
        this.log(
          "ENTRY #1 PROTECTION | SL FAILED | Execution layer does not have placeFullPositionStopLoss()"
        );

        return false;
      }


      this.log(
        `ENTRY #1 PROTECTION | ` +
        `Placing FULL-POSITION SL | ` +
        `SL=${this.positionState.currentSLPrice} | ` +
        `Quantity=${realQuantity}`
      );


      let slResult;

      try {
        slResult =
          await this.execution.placeFullPositionStopLoss({
            symbol:
              this.symbol,

            positionSide:
              this.direction,

            triggerPrice:
              this.positionState.currentSLPrice,

            triggerPriceType:
              "MARK_PRICE",

            clientAlgoId:
              `adv-${this.id}-sl`,

            // IMPORTANT:
            // USE REAL WEEX POSITION SIZE
            quantity:
              realQuantity,
          });

      } catch (error) {
        this.log(
          `ENTRY #1 PROTECTION | ` +
          `SL ERROR: ${error.message}`
        );

        return false;
      }


      if (
        !slResult?.success
      ) {
        this.log(
          `ENTRY #1 PROTECTION | ` +
          `SL CREATE FAILED`
        );

        return false;
      }


      this.positionState.slOrderId =
        this.extractTPOrderId(
          slResult
        );


      if (
        this.position
      ) {
        this.position.slOrderId =
          this.positionState.slOrderId;
      }


      this.log(
        `ENTRY #1 PROTECTION | ` +
        `FULL-POSITION SL CREATED | ` +
        `SL=${this.positionState.currentSLPrice} | ` +
        `Quantity=${realQuantity} | ` +
        `OrderID=${this.positionState.slOrderId ?? "UNKNOWN"}`
      );


      // ========================================================
      // TP IMMEDIATELY AFTER SL
      // ========================================================

      if (
        typeof this.execution.placeFullPositionTakeProfit !==
        "function"
      ) {
        this.log(
          "ENTRY #1 PROTECTION | TP FAILED | Execution layer does not have placeFullPositionTakeProfit()"
        );

        return false;
      }


      this.log(
        `ENTRY #1 PROTECTION | ` +
        `Placing FULL-POSITION TP immediately after SL | ` +
        `TP=${realTP} | ` +
        `Quantity=${realQuantity}`
      );


      let tpResult;

      try {
        tpResult =
          await this.execution.placeFullPositionTakeProfit({
            symbol:
              this.symbol,

            positionSide:
              this.direction,

            triggerPrice:
              realTP,

            triggerPriceType:
              "MARK_PRICE",

            clientAlgoId:
              `adv-${this.id}-tp`,

            // IMPORTANT:
            // USE REAL WEEX POSITION SIZE
            quantity:
              realQuantity,
          });

      } catch (error) {
        this.log(
          `ENTRY #1 PROTECTION | ` +
          `TP ERROR: ${error.message}`
        );

        return false;
      }


      if (
        !tpResult?.success
      ) {
        this.log(
          `ENTRY #1 PROTECTION | ` +
          `TP CREATE FAILED`
        );

        return false;
      }


      const tpOrderId =
        this.extractTPOrderId(
          tpResult
        );

      this.positionState.tpOrderId =
        tpOrderId;


      if (
        this.position
      ) {
        this.position.tpOrderId =
          tpOrderId;
      }


      this.log(
        `ENTRY #1 PROTECTION COMPLETE | ` +
        `SL=${this.positionState.currentSLPrice} | ` +
        `TP=${realTP} | ` +
        `Quantity=${realQuantity} | ` +
        `SL OrderID=${this.positionState.slOrderId ?? "UNKNOWN"} | ` +
        `TP OrderID=${tpOrderId ?? "UNKNOWN"}`
      );


      return true;

    } catch (error) {
      this.positionState.lastPositionSyncError =
        error.message;

      this.log(
        `ENTRY #1 PROTECTION ERROR: ${error.message}`
      );

      return false;

    } finally {
      this.protectionInProgress =
        false;
    }
  }


  // ============================================================
  // SCHEDULE TP POSITION SYNC
  // ============================================================

  scheduleTPPositionSync() {
    if (
      this.tpSyncTimer
    ) {
      clearTimeout(
        this.tpSyncTimer
      );

      this.tpSyncTimer =
        null;
    }

    const delay =
      this.tpPositionSyncDelayMs;

    this.log(
      `TP POSITION SYNC scheduled | ` +
      `Delay=${(delay / 1000).toFixed(1)}s`
    );

    this.tpSyncTimer =
      setTimeout(
        async () => {
          this.tpSyncTimer =
            null;

          await this.syncTPFromWEEX();
        },
        delay
      );
  }


  // ============================================================
  // SYNC POSITION FROM WEEX
  // ============================================================

  async syncTPFromWEEX() {
    if (
      this.status !== "RUNNING"
    ) {
      return;
    }

    if (
      this.entryCount <= 0
    ) {
      return;
    }

    if (
      this.tpSyncInProgress
    ) {
      this.log(
        "TP sync skipped | another TP sync is already running"
      );

      return;
    }

    this.tpSyncInProgress =
      true;

    this.tpSyncNumber +=
      1;

    const syncNumber =
      this.tpSyncNumber;

    try {
      this.log(
        `TP SYNC #${syncNumber} | ` +
        `Requesting REAL WEEX position...`
      );


      // ========================================================
      // KILL ZONE CHECK
      // ========================================================

      if (
        this.killZone.enabled
      ) {
        const killed =
          await this.checkPriceKillZone();

        if (killed) {
          this.log(
            `TP SYNC #${syncNumber} | ` +
            `ABORTED | Kill Zone triggered`
          );

          return;
        }
      }


      // ========================================================
      // ASK WEEX
      // ========================================================

      const position =
        await this.execution.getPosition({
          symbol:
            this.symbol,

          positionSide:
            this.direction,
        });


      if (
        !position ||
        position.connected !== true
      ) {
        this.positionState.lastPositionSyncAt =
          new Date().toISOString();

        this.positionState.lastPositionSyncError =
          position?.reason ||
          "WEEX position data unavailable";

        this.log(
          `TP SYNC #${syncNumber} | ` +
          `WEEX position unavailable | ` +
          `${this.positionState.lastPositionSyncError}`
        );

        return;
      }


      if (
        position.authenticated === false
      ) {
        this.positionState.lastPositionSyncAt =
          new Date().toISOString();

        this.positionState.lastPositionSyncError =
          "WEEX position request is not authenticated";

        this.log(
          `TP SYNC #${syncNumber} | ` +
          `Authentication failed`
        );

        return;
      }


      this.log(
        `TP SYNC #${syncNumber} | ` +
        `WEEX connected=${position.connected} | ` +
        `authenticated=${position.authenticated} | ` +
        `hasPosition=${position.hasPosition}`
      );


      if (
        position.hasPosition === false
      ) {
        this.positionState.lastPositionSyncAt =
          new Date().toISOString();

        this.positionState.lastPositionSyncError =
          "WEEX reports no open position";

        this.log(
          `TP SYNC #${syncNumber} | ` +
          `WEEX reports NO OPEN POSITION | ` +
          `Local position state preserved`
        );

        return;
      }


      // ========================================================
      // REAL SIZE
      // ========================================================

      const weexSize =
        Number(
          position.size
        );

      if (
        !Number.isFinite(weexSize) ||
        weexSize <= 0
      ) {
        this.positionState.lastPositionSyncAt =
          new Date().toISOString();

        this.positionState.lastPositionSyncError =
          "WEEX position size is invalid";

        this.log(
          `TP SYNC #${syncNumber} | ` +
          `INVALID WEEX POSITION SIZE=${position.size}`
        );

        return;
      }

      this.positionState.contracts =
        weexSize;


      // ========================================================
      // REAL AVERAGE
      // ========================================================

      let averageEntryPrice =
        Number(
          position.averageEntryPrice ??
          position.avgEntryPrice ??
          position.entryPrice ??
          NaN
        );


      if (
        !Number.isFinite(
          averageEntryPrice
        ) ||
        averageEntryPrice <= 0
      ) {
        if (
          typeof this.execution.calculateAverageEntry ===
          "function"
        ) {
          averageEntryPrice =
            this.execution.calculateAverageEntry({
              openValue:
                position.openValue,

              size:
                position.size,
            });
        }
      }


      if (
        !Number.isFinite(
          averageEntryPrice
        ) ||
        averageEntryPrice <= 0
      ) {
        this.positionState.lastPositionSyncAt =
          new Date().toISOString();

        this.positionState.lastPositionSyncError =
          "WEEX position received but average entry could not be calculated";

        this.log(
          `TP SYNC #${syncNumber} | ` +
          `REAL POSITION FOUND but average entry is invalid`
        );

        return;
      }


      this.positionState.averageEntryPrice =
        averageEntryPrice;

      this.positionState.lastPositionSyncAt =
        new Date().toISOString();

      this.positionState.lastPositionSyncError =
        null;


      if (
        this.position
      ) {
        this.position.averageEntryPrice =
          averageEntryPrice;

        this.position.contracts =
          weexSize;
      }


      // ========================================================
      // RECALCULATE TP
      // ========================================================

      const newTP =
        this.calculateTP(
          averageEntryPrice
        );

      if (
        !Number.isFinite(newTP) ||
        newTP <= 0
      ) {
        throw new Error(
          "Calculated TP is invalid"
        );
      }


      const oldTP =
        this.positionState.tpPrice;

      this.positionState.tpPrice =
        newTP;


      if (
        this.position
      ) {
        this.position.averageEntryPrice =
          averageEntryPrice;

        this.position.contracts =
          this.positionState.contracts;

        this.position.tpPrice =
          newTP;

        this.position.slPrice =
          this.positionState.currentSLPrice;

        this.position.tpOrderId =
          this.positionState.tpOrderId;
      }


      this.log(
        `TP SYNC #${syncNumber} | ` +
        `REAL WEEX POSITION | ` +
        `Size=${this.positionState.contracts} | ` +
        `Average=${averageEntryPrice}`
      );

      this.log(
        `TP SYNC #${syncNumber} | ` +
        `Old TP=${oldTP ?? "NONE"} | ` +
        `New TP=${newTP} | ` +
        `SL=${this.positionState.currentSLPrice ?? "NONE"}`
      );


      // ========================================================
      // EXISTING TP
      // ========================================================

      if (
        this.positionState.tpOrderId
      ) {
        if (
          typeof this.execution.modifyFullPositionTakeProfit !==
          "function"
        ) {
          this.positionState.lastPositionSyncError =
            "Execution layer does not have modifyFullPositionTakeProfit()";

          this.log(
            `TP SYNC #${syncNumber} | ` +
            `REAL AVERAGE UPDATED | ` +
            `TP MODIFY NOT AVAILABLE`
          );

          return;
        }


        this.log(
          `TP SYNC #${syncNumber} | ` +
          `Updating existing TP | ` +
          `OrderID=${this.positionState.tpOrderId}`
        );


        const modifyResult =
          await this.execution.modifyFullPositionTakeProfit({
            orderId:
              this.positionState.tpOrderId,

            symbol:
              this.symbol,

            positionSide:
              this.direction,

            triggerPrice:
              newTP,

            triggerPriceType:
              "MARK_PRICE",
          });


        if (
          modifyResult?.success
        ) {
          this.log(
            `TP SYNC #${syncNumber} | ` +
            `TP UPDATED | ` +
            `OrderID=${this.positionState.tpOrderId} | ` +
            `New TP=${newTP}`
          );

        } else {
          this.log(
            `TP SYNC #${syncNumber} | ` +
            `TP UPDATE FAILED | ` +
            `OrderID=${this.positionState.tpOrderId}`
          );
        }


      } else {

        // ======================================================
        // FALLBACK TP
        // ======================================================

        this.log(
          `TP SYNC #${syncNumber} | ` +
          `No existing TP Order ID`
        );

        this.log(
          `TP SYNC #${syncNumber} | ` +
          `Creating full-position TP fallback | ` +
          `Quantity=${weexSize}`
        );


        const tpResult =
          await this.execution.placeFullPositionTakeProfit({
            symbol:
              this.symbol,

            positionSide:
              this.direction,

            triggerPrice:
              newTP,

            triggerPriceType:
              "MARK_PRICE",

            clientAlgoId:
              `adv-${this.id}-tp`,

            // IMPORTANT:
            // USE REAL WEEX POSITION SIZE
            quantity:
              weexSize,
          });


        if (
          tpResult?.success
        ) {
          const newTPOrderId =
            this.extractTPOrderId(
              tpResult
            );

          this.positionState.tpOrderId =
            newTPOrderId;

          if (
            this.position
          ) {
            this.position.tpOrderId =
              newTPOrderId;
          }

          this.log(
            `TP SYNC #${syncNumber} | ` +
            `TP CREATED | ` +
            `Price=${newTP} | ` +
            `Quantity=${weexSize} | ` +
            `OrderID=${newTPOrderId ?? "UNKNOWN"}`
          );

        } else {
          this.log(
            `TP SYNC #${syncNumber} | ` +
            `TP CREATE FAILED`
          );
        }
      }

    } catch (error) {
      this.positionState.lastPositionSyncError =
        error.message;

      this.positionState.lastPositionSyncAt =
        new Date().toISOString();

      this.log(
        `TP SYNC #${syncNumber} ERROR: ${error.message}`
      );

    } finally {
      this.tpSyncInProgress =
        false;
    }
  }


  // ============================================================
  // RECORD WINNING TRADE
  // ============================================================

  recordWinningTrade(exitPrice) {
    const exit =
      Number(exitPrice);

    const entry =
      Number(
        this.positionState.entryPrice
      );

    if (
      !Number.isFinite(exit) ||
      exit <= 0
    ) {
      return null;
    }

    if (
      !Number.isFinite(entry) ||
      entry <= 0
    ) {
      return null;
    }

    let gap =
      null;

    if (
      this.direction === "LONG"
    ) {
      gap =
        exit - entry;

    } else if (
      this.direction === "SHORT"
    ) {
      gap =
        entry - exit;
    }

    if (
      !Number.isFinite(gap) ||
      gap <= 0
    ) {
      return null;
    }

    const gapPercent =
      (
        gap /
        entry
      ) *
      100;

    this.positionState.winningGapPrice =
      gap;

    this.positionState.winningGapPercent =
      gapPercent;

    this.positionState.isWinner =
      true;

    this.positionState.lastExitPrice =
      exit;

    this.positionState.lastExitReason =
      "WIN";

    this.log(
      `WINNING TRADE | ` +
      `Entry=${entry} | ` +
      `Exit=${exit} | ` +
      `Gap=${gap} | ` +
      `Gap=${gapPercent.toFixed(4)}%`
    );

    return {
      gapPrice:
        gap,

      gapPercent:
        gapPercent,
    };
  }


  // ============================================================
  // CALCULATE NEXT DYNAMIC SL
  // ============================================================

  calculateSLFromWinningGap(entryPrice) {
    const entry =
      Number(entryPrice);

    const gap =
      Number(
        this.positionState.winningGapPrice
      );

    if (
      !Number.isFinite(entry) ||
      entry <= 0
    ) {
      return null;
    }

    if (
      !Number.isFinite(gap) ||
      gap <= 0
    ) {
      return null;
    }

    if (
      this.direction === "LONG"
    ) {
      return (
        entry - gap
      );
    }

    if (
      this.direction === "SHORT"
    ) {
      return (
        entry + gap
      );
    }

    return null;
  }


  // ============================================================
  // UPDATE SL FROM WINNING GAP
  // ============================================================

  updateSLFromWinningGap(entryPrice) {
    const newSL =
      this.calculateSLFromWinningGap(
        entryPrice
      );

    if (
      !Number.isFinite(newSL) ||
      newSL <= 0
    ) {
      return null;
    }

    this.positionState.currentSLPrice =
      newSL;

    if (
      this.position
    ) {
      this.position.slPrice =
        newSL;
    }

    this.log(
      `NEW DYNAMIC SL | ` +
      `Entry=${entryPrice} | ` +
      `Gap=${this.positionState.winningGapPrice} | ` +
      `New SL=${newSL}`
    );

    return newSL;
  }


  // ============================================================
  // CLEAR POSITION STATE
  // ============================================================

  clearPositionState() {
    if (
      this.tpSyncTimer
    ) {
      clearTimeout(
        this.tpSyncTimer
      );

      this.tpSyncTimer =
        null;
    }

    this.tpSyncInProgress =
      false;

    this.protectionInProgress =
      false;

    this.positionState.side =
      null;

    this.positionState.entryPrice =
      null;

    this.positionState.averageEntryPrice =
      null;

    this.positionState.contracts =
      0;

    this.positionState.initialSLPrice =
      null;

    this.positionState.currentSLPrice =
      null;

    this.positionState.tpPrice =
      null;

    this.positionState.tpOrderId =
      null;

    this.positionState.slOrderId =
      null;

    this.positionState.winningGapPrice =
      null;

    this.positionState.winningGapPercent =
      null;

    this.positionState.tradeNumber =
      0;

    this.positionState.isWinner =
      false;

    this.positionState.lastExitPrice =
      null;

    this.positionState.lastExitReason =
      null;

    this.positionState.lastPositionSyncAt =
      null;

    this.positionState.lastPositionSyncError =
      null;

    this.positionEntries =
      [];

    this.position =
      null;
  }


  // ============================================================
  // START
  // ============================================================

  async start() {
    if (
      this.status === "RUNNING"
    ) {
      return;
    }

    if (!this.symbol) {
      throw new Error(
        "Advanced bot requires a symbol"
      );
    }

    if (
      this.direction !== "LONG" &&
      this.direction !== "SHORT"
    ) {
      throw new Error(
        "Advanced bot direction must be LONG or SHORT"
      );
    }

    this.status =
      "RUNNING";

    this.startNewCycle();

    this.log(
      `Started | ${this.symbol} | ${this.direction}`
    );

    this.log(
      `Cycle: ${this.cycleMinutes} minutes`
    );

    this.log(
      `Trigger Minutes: ${this.cycleTriggerMinutes}`
    );

    this.log(
      `Max Entries: ${this.maxEntries}`
    );

    this.log(
      `Position Settings | margin=${this.marginUSDT} USDT | leverage=${this.leverage}x`
    );

    this.log(
      `TP/SL Settings | ` +
      `TP=${this.tpPercent}% | ` +
      `Initial SL=${this.slPercent}% | ` +
      `Dynamic SL=${this.dynamicSlPercent}%`
    );

    this.log(
      `TP Position Sync Delay=${(
        this.tpPositionSyncDelayMs /
        1000
      ).toFixed(1)}s`
    );

    this.log(
      `ENTRY #1 Protection | ` +
      `Delay=${this.protectionDelayMs / 1000}s | ` +
      `Timeout=${this.protectionTimeoutMs / 1000}s | ` +
      `Poll=${this.protectionPollIntervalMs / 1000}s`
    );


    // ==========================================================
    // WEEX AUTH STATUS
    // ==========================================================

    this.log(
      `WEEX Execution | ` +
      `Authenticated=${this.execution.authEnabled ? "YES" : "NO"}`
    );


    // ==========================================================
    // ORDER CALCULATION
    // ==========================================================

    try {
      await this.calculateOrderSize();

    } catch (error) {
      this.log(
        `Order calculation error: ${error.message}`
      );
    }


    // ==========================================================
    // KILL ZONE
    // ==========================================================

    this.startKillZoneMonitor();


    // ==========================================================
    // TRIGGER LINE
    // ==========================================================

    if (
      this.triggerLine.enabled
    ) {
      this.log(
        "Trigger Line: ENABLED | Getting one startup market price..."
      );

      await this.initializeTriggerLineAtCurrentPrice();

      this.startTriggerLineMonitor();

      return;
    }


    this.startCycleScanner();
  }


  // ============================================================
  // START CYCLE SCANNER
  // ============================================================

  startCycleScanner() {
    if (
      this.status !== "RUNNING"
    ) {
      return;
    }

    if (
      this.triggerLine.enabled &&
      !this.triggerLine.armed
    ) {
      return;
    }

    if (this.interval) {
      return;
    }

    this.log(
      "Order-book scanner STARTED"
    );

    this.processCycleScan();

    this.interval =
      setInterval(
        () => {
          this.processCycleScan();
        },
        this.cycleIntervalMs
      );
  }


  // ============================================================
  // STOP
  // ============================================================

  stop() {
    if (this.interval) {
      clearInterval(
        this.interval
      );

      this.interval =
        null;
    }

    if (this.killZoneInterval) {
      clearInterval(
        this.killZoneInterval
      );

      this.killZoneInterval =
        null;
    }

    if (this.triggerLineInterval) {
      clearInterval(
        this.triggerLineInterval
      );

      this.triggerLineInterval =
        null;
    }

    if (this.tpSyncTimer) {
      clearTimeout(
        this.tpSyncTimer
      );

      this.tpSyncTimer =
        null;
    }

    this.protectionInProgress =
      false;

    if (
      this.status !== "KILLED"
    ) {
      this.status =
        "STOPPED";
    }

    this.log(
      "Stopped"
    );
  }


  // ============================================================
  // KILL BOT
  // ============================================================

  kill(
    reason = "Bot killed"
  ) {
    if (this.interval) {
      clearInterval(
        this.interval
      );

      this.interval =
        null;
    }

    if (this.killZoneInterval) {
      clearInterval(
        this.killZoneInterval
      );

      this.killZoneInterval =
        null;
    }

    if (this.triggerLineInterval) {
      clearInterval(
        this.triggerLineInterval
      );

      this.triggerLineInterval =
        null;
    }

    if (this.tpSyncTimer) {
      clearTimeout(
        this.tpSyncTimer
      );

      this.tpSyncTimer =
        null;
    }

    this.status =
      "KILLED";

    this.log(
      `KILLED: ${reason}`
    );
  }


  // ============================================================
  // START NEW CYCLE
  // ============================================================

  startNewCycle() {
    this.cycleStartedAt =
      new Date().toISOString();

    this.cycleScans =
      0;

    this.cycleTriggerCount =
      0;

    this.cycleDecision =
      "NEUTRAL";

    this.cycleDecisionHistory =
      [];
  }


  // ============================================================
  // NORMALIZE DECISION
  // ============================================================

  normalizeDecision(
    decision
  ) {
    const value =
      String(
        decision || ""
      )
        .trim()
        .toUpperCase();

    if (
      value === "LONG" ||
      value === "SHORT"
    ) {
      return value;
    }

    return "NEUTRAL";
  }


  // ============================================================
  // TICKER PRICE
  // ============================================================

  getTickerPrice(ticker) {
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
  // CURRENT MARKET PRICE
  // ============================================================

  async getCurrentPrice() {
    const ticker =
      await getTicker(
        this.symbol
      );

    const price =
      this.getTickerPrice(
        ticker
      );

    if (
      Number.isFinite(price) &&
      price > 0
    ) {
      this.lastPrice =
        price;

      return price;
    }

    return null;
  }


  // ============================================================
  // INITIALIZE TRIGGER LINE
  // ============================================================

  async initializeTriggerLineAtCurrentPrice() {
    if (
      !this.triggerLine.enabled
    ) {
      return;
    }

    if (
      this.triggerLine.initializing
    ) {
      return;
    }

    this.triggerLine.initializing =
      true;

    try {
      const price =
        await this.getCurrentPrice();

      if (
        !Number.isFinite(price) ||
        price <= 0
      ) {
        throw new Error(
          "Current market price is not available"
        );
      }

      const triggerPrice =
        Number(
          this.triggerLine.price
        );

      if (
        !Number.isFinite(triggerPrice) ||
        triggerPrice <= 0
      ) {
        throw new Error(
          "Trigger Line price is not configured"
        );
      }

      this.triggerLine.initialized =
        true;

      this.triggerLine.initializedAt =
        new Date().toISOString();

      this.triggerLine.armed =
        false;

      this.triggerLine.triggeredAt =
        null;

      this.triggerLine.previousPrice =
        price;

      if (
        this.direction === "LONG"
      ) {
        this.triggerLine.waitingForReset =
          price <= triggerPrice;

      } else if (
        this.direction === "SHORT"
      ) {
        this.triggerLine.waitingForReset =
          price >= triggerPrice;
      }

      this.log(
        `Trigger Line = ${triggerPrice}`
      );

      this.log(
        `Startup Price Reference = ${price}`
      );

      this.log(
        `Trigger Line READY | ${this.direction} | Waiting for fresh touch`
      );

    } catch (error) {
      this.log(
        `Trigger Line initialization error: ${error.message}`
      );

    } finally {
      this.triggerLine.initializing =
        false;
    }
  }


  // ============================================================
  // CHECK TRIGGER LINE
  // ============================================================

  checkTriggerLineWithPrice(
    price
  ) {
    if (
      this.status !== "RUNNING"
    ) {
      return;
    }

    if (
      !this.triggerLine.enabled
    ) {
      return;
    }

    if (
      !this.triggerLine.initialized
    ) {
      return;
    }

    if (
      this.triggerLine.armed
    ) {
      return;
    }

    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {
      return;
    }

    const triggerPrice =
      Number(
        this.triggerLine.price
      );

    if (
      !Number.isFinite(triggerPrice) ||
      triggerPrice <= 0
    ) {
      return;
    }

    const previousPrice =
      Number(
        this.triggerLine.previousPrice
      );


    // ==========================================================
    // LONG
    // ==========================================================

    if (
      this.direction === "LONG"
    ) {
      if (
        this.triggerLine.waitingForReset
      ) {
        if (
          price > triggerPrice
        ) {
          this.triggerLine.waitingForReset =
            false;
        }

        this.triggerLine.previousPrice =
          price;

        return;
      }

      const touched =
        price <= triggerPrice &&
        (
          !Number.isFinite(previousPrice) ||
          previousPrice > triggerPrice
        );

      if (touched) {
        this.armTriggerLine(
          price
        );

        return;
      }
    }


    // ==========================================================
    // SHORT
    // ==========================================================

    if (
      this.direction === "SHORT"
    ) {
      if (
        this.triggerLine.waitingForReset
      ) {
        if (
          price < triggerPrice
        ) {
          this.triggerLine.waitingForReset =
            false;
        }

        this.triggerLine.previousPrice =
          price;

        return;
      }

      const touched =
        price >= triggerPrice &&
        (
          !Number.isFinite(previousPrice) ||
          previousPrice < triggerPrice
        );

      if (touched) {
        this.armTriggerLine(
          price
        );

        return;
      }
    }

    this.triggerLine.previousPrice =
      price;
  }


  // ============================================================
  // ARM TRIGGER LINE
  // ============================================================

  armTriggerLine(
    price
  ) {
    if (
      this.triggerLine.armed
    ) {
      return;
    }

    this.triggerLine.armed =
      true;

    this.triggerLine.triggeredAt =
      new Date().toISOString();

    this.triggerLine.previousPrice =
      price;

    this.triggerLine.waitingForReset =
      false;

    this.log(
      `TRIGGER LINE ARMED | ${this.direction} | Price ${price}`
    );

    this.startCycleScanner();
  }


  // ============================================================
  // TRIGGER LINE MONITOR
  // ============================================================

  startTriggerLineMonitor() {
    if (
      !this.triggerLine.enabled
    ) {
      return;
    }

    if (
      this.triggerLineInterval
    ) {
      clearInterval(
        this.triggerLineInterval
      );

      this.triggerLineInterval =
        null;
    }

    const intervalMs =
      this.triggerLineCheckIntervalMs;

    this.log(
      `Trigger Line Monitor STARTED | ` +
      `Interval=${intervalMs}ms`
    );

    this.triggerLineInterval =
      setInterval(
        async () => {

          if (
            this.status !== "RUNNING"
          ) {
            return;
          }

          if (
            !this.triggerLine.enabled
          ) {
            return;
          }

          if (
            !this.triggerLine.initialized
          ) {
            return;
          }

          if (
            this.triggerLine.armed
          ) {
            return;
          }

          try {
            const price =
              await this.getCurrentPrice();

            if (
              !Number.isFinite(price) ||
              price <= 0
            ) {
              return;
            }

            this.checkTriggerLineWithPrice(
              price
            );

          } catch (error) {
            this.log(
              `Trigger Line Monitor error: ${error.message}`
            );
          }
        },
        intervalMs
      );
  }


  // ============================================================
  // ORDER BOOK SCAN
  // ============================================================

  async scan() {
    if (
      this.status !== "RUNNING"
    ) {
      return null;
    }

    if (
      this.triggerLine.enabled &&
      !this.triggerLine.armed
    ) {
      return null;
    }

    const snapshot =
      await getOrderBook(
        this.symbol,
        200
      );

    let marketPrice =
      null;

    try {
      if (
        snapshot &&
        Array.isArray(snapshot.bids) &&
        Array.isArray(snapshot.asks) &&
        snapshot.bids.length > 0 &&
        snapshot.asks.length > 0
      ) {
        const bid =
          Number(
            snapshot.bids[0]?.[0] ??
            snapshot.bids[0]?.price ??
            NaN
          );

        const ask =
          Number(
            snapshot.asks[0]?.[0] ??
            snapshot.asks[0]?.price ??
            NaN
          );

        if (
          Number.isFinite(bid) &&
          bid > 0 &&
          Number.isFinite(ask) &&
          ask > 0
        ) {
          marketPrice =
            (bid + ask) / 2;

        } else if (
          Number.isFinite(bid) &&
          bid > 0
        ) {
          marketPrice =
            bid;

        } else if (
          Number.isFinite(ask) &&
          ask > 0
        ) {
          marketPrice =
            ask;
        }
      }
    } catch {
      marketPrice =
        null;
    }

    if (
      Number.isFinite(marketPrice)
    ) {
      this.lastPrice =
        marketPrice;

      this.checkTriggerLineWithPrice(
        marketPrice
      );
    }

    const analysis =
      this.orderBook.analyze(
        snapshot
      );

    const normalizedDecision =
      this.normalizeDecision(
        analysis.decision
      );

    this.lastScanAt =
      new Date().toISOString();

    this.lastDecision =
      normalizedDecision;

    this.lastAnalysis = {
      ...analysis,

      decision:
        normalizedDecision,
    };

    return {
      snapshot,

      analysis: {
        ...analysis,

        decision:
          normalizedDecision,
      },
    };
  }


  // ============================================================
  // MANUAL / IMMEDIATE SCAN
  // ============================================================

  async scanNow() {
    const result =
      await this.scan();

    if (!result) {
      return null;
    }

    return result.analysis;
  }


  // ============================================================
  // PROCESS ONE MINUTE
  // ============================================================

  async processCycleScan() {
    if (
      this.status !== "RUNNING"
    ) {
      return;
    }

    if (
      this.triggerLine.enabled &&
      !this.triggerLine.armed
    ) {
      return;
    }

    try {
      const result =
        await this.scan();

      if (!result) {
        return;
      }

      const analysis =
        result.analysis;

      const rawDecision =
        String(
          analysis.decision || ""
        )
          .trim()
          .toUpperCase();

      const isValidTrigger =
        analysis.trigger === true &&
        rawDecision === this.direction;

      const minuteDecision =
        isValidTrigger
          ? this.direction
          : "NEUTRAL";

      if (isValidTrigger) {
        this.cycleTriggerCount +=
          1;
      }

      this.cycleScans +=
        1;

      const historyRow = {
        number:
          this.cycleScans,

        time:
          new Date().toISOString(),

        coin:
          this.symbol,

        trend:
          analysis.trend?.direction ||
          "NEUTRAL",

        depths:
          analysis.depths || [],

        counterTrendCount:
          Number(
            analysis.counterTrendCount ?? 0
          ),

        counterTrendRequired:
          Number(
            analysis.counterTrendRequired ??
            this.orderBookConfig
              .counterTrendRequired
          ),

        trigger:
          Boolean(
            analysis.trigger
          ),

        decision:
          minuteDecision,

        reason:
          analysis.reason ||
          "NO_REASON",
      };

      this.cycleDecisionHistory.push(
        historyRow
      );

      if (
        this.cycleTriggerCount > 0
      ) {
        this.cycleDecision =
          this.direction;
      } else {
        this.cycleDecision =
          "NEUTRAL";
      }

      this.lastDecision =
        minuteDecision;

      this.log(
        `Cycle ${this.cycleNumber} | ` +
        `Scan ${this.cycleScans}/${this.cycleMinutes} | ` +
        `Trend ${analysis.trend?.direction || "NEUTRAL"} | ` +
        `Decision ${minuteDecision} | ` +
        `Triggers ${this.cycleTriggerCount}/${this.cycleTriggerMinutes}`
      );

      if (
        this.cycleScans >=
        this.cycleMinutes
      ) {
        await this.completeCycle();
      }

    } catch (error) {
      this.log(
        `Scan error: ${error.message}`
      );
    }
  }


  // ============================================================
  // COMPLETE CYCLE
  // ============================================================

  async completeCycle() {
    const finalDecision =
      this.cycleTriggerCount >=
      this.cycleTriggerMinutes
        ? this.direction
        : "NEUTRAL";

    const latestAnalysis =
      this.lastAnalysis || {};

    const completedCycle = {
      cycleNumber:
        this.cycleNumber,

      time:
        new Date().toISOString(),

      coin:
        this.symbol,

      trend:
        latestAnalysis.trend?.direction ||
        "NEUTRAL",

      entryVotes:
        this.cycleTriggerCount,

      requiredVotes:
        this.cycleTriggerMinutes,

      totalScans:
        this.cycleScans,

      decision:
        finalDecision,

      reason:
        this.cycleTriggerCount >=
        this.cycleTriggerMinutes
          ? "TRIGGER_MINUTES_CONFIRMED"
          : "TRIGGER_MINUTES_NOT_REACHED",
    };

    this.completedCycleHistory.push(
      completedCycle
    );

    if (
      this.completedCycleHistory.length >
      100
    ) {
      this.completedCycleHistory.shift();
    }

    this.cycleDecision =
      finalDecision;

    this.lastDecision =
      finalDecision;

    this.log(
      `CYCLE ${this.cycleNumber} COMPLETE | ` +
      `Triggers ${this.cycleTriggerCount}/${this.cycleTriggerMinutes} | ` +
      `FINAL ${finalDecision}`
    );

    if (
      finalDecision ===
      this.direction
    ) {
      await this.executeEntrySignal(
        finalDecision
      );
    }

    this.cycleNumber +=
      1;

    this.startNewCycle();
  }


  // ============================================================
  // EXECUTE ENTRY SIGNAL
  // ============================================================

  async executeEntrySignal(
    decision
  ) {
    if (
      this.status !== "RUNNING"
    ) {
      return;
    }

    const normalizedDecision =
      this.normalizeDecision(
        decision
      );

    if (
      normalizedDecision !==
      this.direction
    ) {
      return;
    }


    // ==========================================================
    // MAX PYRAMID ENTRIES
    // ==========================================================

    if (
      this.entryCount >=
      this.maxEntries
    ) {
      this.log(
        `ENTRY BLOCKED | ` +
        `Maximum entries reached | ` +
        `${this.entryCount}/${this.maxEntries}`
      );

      return;
    }


    const nextEntryNumber =
      this.entryCount + 1;


    this.log(
      `ENTRY SIGNAL | ` +
      `${this.direction} | ` +
      `Entry #${nextEntryNumber}/${this.maxEntries}`
    );


    // ==========================================================
    // LIVE WEEX POSITION GUARD
    // ==========================================================

    try {
      const livePosition =
        await this.execution.getPosition({
          symbol:
            this.symbol,

          positionSide:
            this.direction,
        });


      if (
        !livePosition ||
        livePosition.connected !== true
      ) {
        this.log(
          `ENTRY #${nextEntryNumber} BLOCKED | ` +
          `WEEX position data unavailable`
        );

        return;
      }


      if (
        livePosition.authenticated === false
      ) {
        this.log(
          `ENTRY #${nextEntryNumber} BLOCKED | ` +
          `WEEX authentication failed`
        );

        return;
      }


      const liveSize =
        Number(
          livePosition.size ?? 0
        );


      if (
        nextEntryNumber === 1
      ) {
        if (
          livePosition.hasPosition === true ||
          (
            Number.isFinite(liveSize) &&
            liveSize > 0
          )
        ) {
          this.log(
            `ENTRY #1 BLOCKED | ` +
            `WEEX already has an open ${this.direction} position | ` +
            `Size=${liveSize}`
          );

          return;
        }

      } else {
        if (
          livePosition.hasPosition !== true ||
          !Number.isFinite(liveSize) ||
          liveSize <= 0
        ) {
          this.log(
            `PYRAMID #${nextEntryNumber} BLOCKED | ` +
            `WEEX position does not exist`
          );

          return;
        }

        this.log(
          `PYRAMID #${nextEntryNumber} | ` +
          `Existing WEEX position confirmed | ` +
          `Size=${liveSize}`
        );
      }

    } catch (error) {
      this.log(
        `ENTRY #${nextEntryNumber} BLOCKED | ` +
        `WEEX position check failed: ${error.message}`
      );

      return;
    }


    // ==========================================================
    // CALCULATE ORDER SIZE
    // ==========================================================

    let order;

    try {
      order =
        await this.calculateOrderSize();

    } catch (error) {
      this.log(
        `ENTRY #${nextEntryNumber} BLOCKED | ` +
        `Order calculation failed: ${error.message}`
      );

      return;
    }


    if (
      !order ||
      !Number.isFinite(
        Number(order.contracts)
      ) ||
      Number(order.contracts) <= 0
    ) {
      this.log(
        `ENTRY #${nextEntryNumber} BLOCKED | ` +
        `Invalid order size`
      );

      return;
    }


    // ==========================================================
    // GET CURRENT MARKET PRICE
    // ==========================================================

    const entryPrice =
      await this.getCurrentPrice();


    if (
      !Number.isFinite(entryPrice) ||
      entryPrice <= 0
    ) {
      this.log(
        `ENTRY #${nextEntryNumber} BLOCKED | ` +
        `Current market price unavailable`
      );

      return;
    }


    // ==========================================================
    // OPEN POSITION
    // ==========================================================

    let openResult;

    try {
      this.log(
        `ENTRY #${nextEntryNumber} | ` +
        `Opening ${this.direction} | ` +
        `Contracts=${order.contracts} | ` +
        `Price=${entryPrice}`
      );


openResult =
  await this.execution.openPosition({
    symbol:
      this.symbol,

    direction:
      this.direction,

    quantity:
      order.contracts,

    clientOrderId:
      `adv-open-${Date.now()}`,
  });

    } catch (error) {
      this.log(
        `ENTRY #${nextEntryNumber} FAILED | ` +
        `Open position error: ${error.message}`
      );

      return;
    }


    // ==========================================================
    // OPEN RESULT CHECK
    // ==========================================================

    if (
      openResult?.success === false
    ) {
      this.log(
        `ENTRY #${nextEntryNumber} FAILED | ` +
        `WEEX open rejected`
      );

      return;
    }


    // ==========================================================
    // ENTRY COUNT
    // ==========================================================

    this.entryCount =
      nextEntryNumber;


    // ==========================================================
    // RECORD LOCAL POSITION ENTRY
    // ==========================================================

    this.recordPositionEntry({
      entryPrice:
        entryPrice,

      contracts:
        order.contracts,

      result:
        openResult,
    });


    this.entrySignals.push({
      time:
        new Date().toISOString(),

      symbol:
        this.symbol,

      direction:
        this.direction,

      entryNumber:
        this.entryCount,

      price:
        entryPrice,

      contracts:
        order.contracts,

      decision:
        normalizedDecision,
    });


    if (
      this.entrySignals.length >
      100
    ) {
      this.entrySignals.shift();
    }


    this.log(
      `ENTRY #${this.entryCount} RECORDED | ` +
      `${this.direction} | ` +
      `Price=${entryPrice} | ` +
      `Contracts=${order.contracts}`
    );


    // ==========================================================
    // ENTRY #1
    // ==========================================================

    if (
      this.entryCount === 1
    ) {
      this.log(
        `ENTRY #1 | ` +
        `Initial SL calculated at ` +
        `${this.positionState.currentSLPrice ?? "NONE"}`
      );

      this.log(
        `ENTRY #1 | ` +
        `Initial TP=${this.positionState.tpPrice ?? "NONE"}`
      );

      this.log(
        `ENTRY #1 | ` +
        `Protection lifecycle STARTED | ` +
        `Delay=${this.protectionDelayMs / 1000}s | ` +
        `Timeout=${this.protectionTimeoutMs / 1000}s`
      );


      const protectedPosition =
        await this.protectEntryOne();


      if (
        protectedPosition
      ) {
        this.log(
          `ENTRY #1 | ` +
          `PROTECTED SUCCESSFULLY`
        );

      } else {
        this.log(
          `ENTRY #1 | ` +
          `PROTECTION FAILED OR TIMED OUT`
        );
      }


    // ==========================================================
    // PYRAMID #2 / #3
    // ==========================================================

    } else {
      this.log(
        `PYRAMID #${this.entryCount} | ` +
        `NO NEW SL | ` +
        `Existing SL=${this.positionState.currentSLPrice ?? "NONE"} | ` +
        `TP Order=${this.positionState.tpOrderId ?? "NONE"}`
      );

      this.scheduleTPPositionSync();
    }
  }


  // ============================================================
  // PRICE KILL ZONE
  // ============================================================

  async checkPriceKillZone() {
    if (
      !this.killZone.enabled
    ) {
      return false;
    }

    const hasLow =
      Number.isFinite(
        this.killZone.low
      );

    const hasHigh =
      Number.isFinite(
        this.killZone.high
      );

    if (
      !hasLow &&
      !hasHigh
    ) {
      return false;
    }

    try {
      const ticker =
        await getTicker(
          this.symbol
        );

      const price =
        this.getTickerPrice(
          ticker
        );

      if (
        !Number.isFinite(price)
      ) {
        return false;
      }

      this.lastPrice =
        price;

      let hit =
        false;

      if (
        hasLow &&
        hasHigh
      ) {
        const low =
          Math.min(
            this.killZone.low,
            this.killZone.high
          );

        const high =
          Math.max(
            this.killZone.low,
            this.killZone.high
          );

        hit =
          price >= low &&
          price <= high;

      } else if (hasLow) {
        hit =
          price <=
          this.killZone.low;

      } else if (hasHigh) {
        hit =
          price >=
          this.killZone.high;
      }

      if (hit) {
        this.kill(
          `Price Kill Zone touched at ${price}`
        );

        return true;
      }

      return false;

    } catch (error) {
      this.log(
        `Kill zone price check error: ${error.message}`
      );

      return false;
    }
  }


  // ============================================================
  // KILL ZONE MONITOR
  // ============================================================

  startKillZoneMonitor() {
    if (
      !this.killZone.enabled
    ) {
      return;
    }

    if (this.killZoneInterval) {
      clearInterval(
        this.killZoneInterval
      );
    }

    this.killZoneInterval =
      setInterval(
        async () => {
          if (
            this.status !== "RUNNING"
          ) {
            return;
          }

          await this.checkPriceKillZone();
        },
        this.killZoneCheckIntervalMs
      );

    this.checkPriceKillZone();
  }


  // ============================================================
  // FRONTEND STATE
  // ============================================================

  getState() {
    return {
      id:
        this.id,

      botType:
        this.botType,

      symbol:
        this.symbol,

      direction:
        this.direction,

      entryModel:
        this.entryModel,

      status:
        this.status,


      // ========================================================
      // POSITION SETTINGS
      // ========================================================

      marginUSDT:
        this.marginUSDT,

      leverage:
        this.leverage,

      orderCalculation:
        this.orderCalculation,


      // ========================================================
      // CYCLE
      // ========================================================

      cycleMinutes:
        this.cycleMinutes,

      cycleTriggerMinutes:
        this.cycleTriggerMinutes,


      // ========================================================
      // ORDER BOOK CONFIG
      // ========================================================

      orderBookConfig:
        {
          ...this.orderBookConfig,

          entryDepths:
            [
              ...this.orderBookConfig.entryDepths,
            ],
        },


      // ========================================================
      // CYCLE STATE
      // ========================================================

      cycle: {
        number:
          this.cycleNumber,

        startedAt:
          this.cycleStartedAt,

        scans:
          this.cycleScans,

        total:
          this.cycleMinutes,

        triggerMinutes:
          this.cycleTriggerCount,

        requiredTriggerMinutes:
          this.cycleTriggerMinutes,

        decision:
          this.cycleDecision,

        decisionHistory:
          this.cycleDecisionHistory.map(
            (row) => ({
              ...row,

              depths:
                Array.isArray(row.depths)
                  ? row.depths
                  : row.depths,
            })
          ),
      },


      // ========================================================
      // COMPLETED CYCLES
      // ========================================================

      completedCycleHistory:
        this.completedCycleHistory,


      // ========================================================
      // PYRAMIDING
      // ========================================================

      maxEntries:
        this.maxEntries,

      entryCount:
        this.entryCount,

      entrySignals:
        this.entrySignals,

      positionEntries:
        this.positionEntries,


      // ========================================================
      // POSITION
      // ========================================================

      position:
        this.position,

      positionState:
        {
          ...this.positionState,
        },


      // ========================================================
      // TP / SL
      // ========================================================

      tpPercent:
        this.tpPercent,

      slPercent:
        this.slPercent,

      dynamicSlPercent:
        this.dynamicSlPercent,

      tpPositionSyncDelayMs:
        this.tpPositionSyncDelayMs,

      tpPositionSyncDelaySeconds:
        this.tpPositionSyncDelayMs /
        1000,

      tpSyncInProgress:
        this.tpSyncInProgress,

      tpSyncNumber:
        this.tpSyncNumber,


      // ========================================================
      // ENTRY #1 PROTECTION
      // ========================================================

      protectionDelayMs:
        this.protectionDelayMs,

      protectionDelaySeconds:
        this.protectionDelayMs /
        1000,

      protectionTimeoutMs:
        this.protectionTimeoutMs,

      protectionTimeoutSeconds:
        this.protectionTimeoutMs /
        1000,

      protectionPollIntervalMs:
        this.protectionPollIntervalMs,

      protectionPollIntervalSeconds:
        this.protectionPollIntervalMs /
        1000,

      protectionInProgress:
        this.protectionInProgress,


      // ========================================================
      // KILL ZONE
      // ========================================================

      killZone:
        {
          ...this.killZone,
        },


      // ========================================================
      // TRIGGER LINE
      // ========================================================

      triggerLine:
        {
          ...this.triggerLine,

          checkIntervalMs:
            this.triggerLineCheckIntervalMs,
        },


      // ========================================================
      // LAST SCAN
      // ========================================================

      lastScanAt:
        this.lastScanAt,

      lastDecision:
        this.normalizeDecision(
          this.lastDecision
        ),

      lastPrice:
        this.lastPrice,

      lastAnalysis:
        this.lastAnalysis
          ? {
              ...this.lastAnalysis,

              decision:
                this.normalizeDecision(
                  this.lastAnalysis.decision
                ),
            }
          : null,


      // ========================================================
      // LOGS
      // ========================================================

      logs:
        [
          ...this.logs,
        ],
    };
  }
}


module.exports =
  AdvancedBot;

