const OrderBookModule = require("../modules/orderBook");

const {
  getOrderBook,
} = require("../market/orderBookData");

const {
  getTicker,
} = require("../market/marketData");

const {
  openPosition,
} = require("../execution/weexExecution");


class AdvancedBot {
  constructor(config = {}) {
    this.id =
      config.id ||
      `advanced_${Date.now()}`;

    this.botType = "ADVANCED";

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
    // ORDER BOOK CONFIGURATION
    // ============================================================

    this.orderBookConfig = {
      trendDepth: 200,

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
    // TP / SL
    // ============================================================

    this.tpPercent =
      Number(
        config.tpPercent ?? 1
      );

    this.slPercent =
      Number(
        config.slPercent ?? 0.8
      );


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
    //
    // IMPORTANT:
    //
    // triggerLine.price = CONFIGURED TRIGGER LINE.
    //
    // The first current WEEX price is ONLY used as a baseline.
    // It NEVER replaces triggerLine.price.
    //
    // Example:
    //
    // Configured Trigger Line = 0.10583
    // Current startup price  = 0.10738
    //
    // Trigger Line remains:
    // 0.10583
    //
    // Startup price is only used to determine where the bot
    // started relative to the Trigger Line.
    //
    // LONG:
    //   If bot starts above line:
    //   wait for a fresh move DOWN through the line.
    //
    //   If bot starts below line:
    //   first wait for a fresh move ABOVE the line,
    //   then wait for a fresh move DOWN through it.
    //
    // SHORT:
    //   If bot starts below line:
    //   wait for a fresh move UP through the line.
    //
    //   If bot starts above line:
    //   first wait for a fresh move BELOW the line,
    //   then wait for a fresh move UP through it.
    //
    // Trigger Line does NOT kill the bot.
    // Trigger Line does NOT execute a trade.
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
  // START
  // ============================================================

  start() {
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


    // ==========================================================
    // KILL ZONE
    // ==========================================================

    this.startKillZoneMonitor();


    // ==========================================================
    // TRIGGER LINE
    //
    // Only the ONE startup ticker request is used to establish
    // the initial price reference.
    //
    // The configured Trigger Line price is NEVER replaced.
    // ==========================================================

    if (
      this.triggerLine.enabled
    ) {
      this.log(
        "Trigger Line: ENABLED | Getting one startup market price..."
      );

      this.initializeTriggerLineAtCurrentPrice();

      return;
    }


    // ==========================================================
    // NO TRIGGER LINE
    // ==========================================================

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

    // First scan immediately.
    this.processCycleScan();

    // Continue scanning every minute.
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

    // WEEX bookTicker returns an array.
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
  //
  // IMPORTANT:
  //
  // This makes ONE WEEX price request.
  //
  // The returned price is ONLY the startup baseline.
  //
  // It does NOT replace triggerLine.price.
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
      // --------------------------------------------------------
      // ONE AND ONLY ONE STARTUP PRICE REQUEST
      // --------------------------------------------------------

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


      // --------------------------------------------------------
      // IMPORTANT:
      //
      // DO NOT CHANGE triggerLine.price HERE.
      //
      // It remains the configured Trigger Line.
      // --------------------------------------------------------

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


      // --------------------------------------------------------
      // SAVE ONLY THE STARTUP BASELINE
      // --------------------------------------------------------

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


      // --------------------------------------------------------
      // DETERMINE INITIAL SIDE
      //
      // This is only used to prevent an old/past touch from
      // triggering immediately.
      // --------------------------------------------------------

      if (
        this.direction === "LONG"
      ) {
        // If starting above the line, a future downward touch
        // can be considered fresh.
        //
        // If starting at/below the line, first require price
        // to move above the line.
        this.triggerLine.waitingForReset =
          price <= triggerPrice;

      } else if (
        this.direction === "SHORT"
      ) {
        // If starting below the line, a future upward touch
        // can be considered fresh.
        //
        // If starting at/above the line, first require price
        // to move below the line.
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
        `Trigger Line READY | ${this.direction} | ` +
        `Waiting for fresh touch`
      );

      // --------------------------------------------------------
      // IMPORTANT:
      //
      // No ticker interval is started here.
      //
      // We do not repeatedly request WEEX ticker data just to
      // maintain the startup Trigger Line reference.
      // --------------------------------------------------------

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
  // CHECK TRIGGER LINE USING AN EXISTING MARKET PRICE
  //
  // This function does NOT request WEEX.
  //
  // The caller supplies a fresh market price.
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


    // Trigger Line armed = start order-book scanning.
    this.startCycleScanner();
  }


  // ============================================================
  // TRIGGER LINE MONITOR
  //
  // IMPORTANT:
  //
  // No WEEX ticker request here.
  //
  // Trigger Line is checked when an existing market/order-book
  // operation provides a fresh price.
  // ============================================================

  startTriggerLineMonitor() {
    // Intentionally no polling timer.
    //
    // The Trigger Line startup price is requested exactly once.
    //
    // Future Trigger Line checks are performed through
    // processCycleScan()/scan() price updates once available.
    return;
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


    // Trigger Line enabled but not armed:
    // no order-book scan.
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


    // ----------------------------------------------------------
    // Use the fresh order-book price if available.
    //
    // This is NOT used to initialize the Trigger Line.
    // ----------------------------------------------------------

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
        this.cycleTriggerCount += 1;
      }


      this.cycleScans += 1;


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


    this.cycleNumber += 1;

    this.startNewCycle();
  }


  // ============================================================
  // ENTRY SIGNAL
  // ============================================================

  async executeEntrySignal(
    decision
  ) {
    if (
      this.status !== "RUNNING"
    ) {
      return;
    }


    if (
      decision !==
      this.direction
    ) {
      return;
    }


    if (
      this.entryCount >=
      this.maxEntries
    ) {
      this.log(
        `Entry blocked | Max entries reached ${this.maxEntries}/${this.maxEntries}`
      );

      return;
    }


    if (
      this.killZone.enabled
    ) {
      const killZoneHit =
        await this.checkPriceKillZone();

      if (killZoneHit) {
        return;
      }
    }


    try {
      const result =
        await openPosition({
          symbol:
            this.symbol,

          direction:
            this.direction,
        });


      this.entryCount += 1;


      const entrySignal = {
        number:
          this.entryCount,

        time:
          new Date().toISOString(),

        symbol:
          this.symbol,

        direction:
          this.direction,

        result,
      };


      this.entrySignals.push(
        entrySignal
      );


      this.log(
        `ENTRY ${this.entryCount}/${this.maxEntries} | ` +
        `${this.direction} | ` +
        `${result?.simulated ? "SIMULATED" : "EXECUTED"}`
      );

    } catch (error) {
      this.log(
        `Entry error: ${error.message}`
      );
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


    // Initial check.
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

          entryDepths: [
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


      // ========================================================
      // POSITION
      // ========================================================

      position:
        this.position,


      // ========================================================
      // TP / SL
      // ========================================================

      tpPercent:
        this.tpPercent,

      slPercent:
        this.slPercent,


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
        [...this.logs],
    };
  }
}


module.exports =
  AdvancedBot;