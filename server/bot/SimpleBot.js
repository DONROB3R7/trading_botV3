const RSIModule = require("../modules/rsi");

const {
  getKlines,
  getTicker,
} = require("../market/marketData");

class SimpleBot {
  constructor(config) {
    this.id = config.id;

    this.symbol = config.symbol;
    this.direction = config.direction;
    this.entryModel = config.entryModel;

    this.tpPercent =
      Number(config.tpPercent ?? 1);

    this.slPercent =
      Number(config.slPercent ?? 0.8);

    this.rsiPeriod =
      Number(config.rsiPeriod ?? 14);

    this.rsiLongEntry =
      Number(config.rsiLongEntry ?? 30);

    this.rsiShortEntry =
      Number(config.rsiShortEntry ?? 70);

    this.status = "STOPPED";

    this.createdAt =
      config.createdAt ||
      new Date().toISOString();

    this.startedAt =
      config.startedAt || null;

    this.lastPrice = null;
    this.lastRSI = null;
    this.lastDecision = "WAIT";
    this.lastReason = null;
    this.lastScanAt = null;

    // =========================================================
    // COMPLETED CANDLE TRACKING
    // =========================================================

    this.lastProcessedCandleTime =
      config.lastProcessedCandleTime || null;

    this.lastProcessedCandleAt =
      config.lastProcessedCandleAt || null;

    // =========================================================
    // POSITION
    // =========================================================

    this.position = {
      status: "FLAT",
      direction: null,
      entryPrice: null,
      currentPrice: null,
      takeProfitPrice: null,
      stopLossPrice: null,
      openedAt: null,
      closedAt: null,
      exitPrice: null,
      exitReason: null,
    };

    this.tradeHistory =
      Array.isArray(config.tradeHistory)
        ? config.tradeHistory
        : [];

    this.lastTrade =
      config.lastTrade || null;

    this.scanTimer = null;
    this.positionTimer = null;

    this.onStateChange = null;

    // =========================================================
    // RSI MODULE
    // =========================================================

    this.rsiModule =
      new RSIModule({
        period: this.rsiPeriod,

        longEntry:
          this.rsiLongEntry,

        shortEntry:
          this.rsiShortEntry,
      });
  }

  // =========================================================
  // STATE CHANGE
  // =========================================================

  notifyStateChange() {
    if (
      typeof this.onStateChange ===
      "function"
    ) {
      this.onStateChange();
    }
  }

  // =========================================================
  // START
  // =========================================================

  start() {
    if (
      this.status ===
      "RUNNING"
    ) {
      return;
    }

    this.status = "RUNNING";

    this.startedAt =
      new Date().toISOString();

    console.log(
      `[Bot:${this.id}] Started ` +
        `${this.symbol} ` +
        `${this.direction} ` +
        `${this.entryModel}`
    );

    this.startScanner();

    this.startPositionMonitor();

    this.notifyStateChange();
  }

  // =========================================================
  // STOP
  // =========================================================

  stop() {
    if (
      this.status ===
      "STOPPED"
    ) {
      return;
    }

    this.status = "STOPPED";

    if (this.scanTimer) {
      clearInterval(
        this.scanTimer
      );

      this.scanTimer = null;
    }

    if (this.positionTimer) {
      clearInterval(
        this.positionTimer
      );

      this.positionTimer = null;
    }

    console.log(
      `[Bot:${this.id}] Stopped`
    );

    this.notifyStateChange();
  }

  // =========================================================
  // SCANNER
  // =========================================================

  startScanner() {
    if (
      this.entryModel !==
      "RSI"
    ) {
      console.log(
        `[Bot:${this.id}] Entry model ` +
          `${this.entryModel} is not implemented yet`
      );

      return;
    }

    // First scan immediately.
    this.scan();

    // Then check every minute.
    //
    // IMPORTANT:
    // We still scan every minute so we can detect
    // when a new 15m candle has completed.
    //
    // The actual strategy decision only happens once
    // per completed candle.
    this.scanTimer =
      setInterval(() => {
        this.scan();
      }, 60 * 1000);
  }

  // =========================================================
  // SCAN
  // =========================================================

  async scan() {
    if (
      this.status !==
      "RUNNING"
    ) {
      return;
    }

    if (
      this.position.status ===
      "OPEN"
    ) {
      return;
    }

    try {
      console.log(
        `[Bot:${this.id}] Scanning ` +
          `${this.symbol} ` +
          `${this.direction}...`
      );

      const candles =
        await getKlines(
          this.symbol,
          "15m",
          100
        );

      if (
        !Array.isArray(candles) ||
        candles.length < 2
      ) {
        throw new Error(
          "Not enough candle data received"
        );
      }

      // =======================================================
      // ONLY USE THE LAST COMPLETED 15M CANDLE
      // =======================================================

      // The last candle is normally the currently
      // forming 15m candle.
      //
      // Therefore:
      //
      // candles[length - 1] = current / unfinished
      // candles[length - 2] = latest completed
      //
      const completedCandle =
        candles[
          candles.length - 2
        ];

      if (
        !Array.isArray(
          completedCandle
        )
      ) {
        throw new Error(
          "Invalid completed candle"
        );
      }

      const candleTime =
        Number(
          completedCandle[0]
        );

      const candleClose =
        Number(
          completedCandle[4]
        );

      if (
        !Number.isFinite(
          candleTime
        )
      ) {
        throw new Error(
          "Invalid completed candle timestamp"
        );
      }

      if (
        !Number.isFinite(
          candleClose
        ) ||
        candleClose <= 0
      ) {
        throw new Error(
          "Invalid completed candle close price"
        );
      }

      // =======================================================
      // SAME CANDLE = DO NOTHING
      // =======================================================

      if (
        this.lastProcessedCandleTime ===
        candleTime
      ) {
        console.log(
          `[Bot:${this.id}] ` +
            `No new completed 15m candle. ` +
            `Waiting...`
        );

        return;
      }

      // =======================================================
      // NEW COMPLETED CANDLE
      // =======================================================

      this.lastProcessedCandleTime =
        candleTime;

      this.lastProcessedCandleAt =
        new Date().toISOString();

      // Only completed candles are used for RSI.
      //
      // Remove the currently forming candle.
      const completedCandles =
        candles.slice(
          0,
          -1
        );

      const closes =
        completedCandles.map(
          (candle) =>
            Number(candle[4])
        );

      if (
        closes.length <
        this.rsiPeriod + 1
      ) {
        throw new Error(
          `Not enough completed candles for RSI. ` +
            `Need at least ${
              this.rsiPeriod + 1
            }, received ${
              closes.length
            }`
        );
      }

      // =======================================================
      // RSI DECISION
      // =======================================================

      const result =
        this.rsiModule.getDecision(
          closes,
          this.direction
        );

      // The strategy price is the close of the
      // completed signal candle.
      this.lastPrice =
        candleClose;

      this.lastRSI =
        result.rsi;

      this.lastDecision =
        result.decision;

      this.lastReason =
        result.reason;

      this.lastScanAt =
        new Date().toISOString();

      console.log(
        `[Bot:${this.id}] ` +
          `Completed 15m candle ` +
          `${new Date(
            candleTime
          ).toISOString()}`
      );

      console.log(
        `[Bot:${this.id}] ` +
          `Close=${candleClose} ` +
          `RSI=${result.rsi} ` +
          `Decision=${result.decision} ` +
          `Reason=${result.reason}`
      );

      this.notifyStateChange();

      // =======================================================
      // PAPER ENTRY
      // =======================================================

      if (
        result.decision ===
        "ENTER"
      ) {
        await this.openPaperPosition(
          candleClose
        );
      }
    } catch (error) {
      console.error(
        `[Bot:${this.id}] Scan error:`,
        error.message
      );

      this.lastReason =
        error.message;

      this.lastScanAt =
        new Date().toISOString();

      this.notifyStateChange();
    }
  }

  // =========================================================
  // PAPER POSITION OPEN
  // =========================================================

  async openPaperPosition(
    price
  ) {
    if (
      this.position.status ===
      "OPEN"
    ) {
      return;
    }

    const entryPrice =
      Number(price);

    if (
      !Number.isFinite(
        entryPrice
      ) ||
      entryPrice <= 0
    ) {
      throw new Error(
        "Invalid paper entry price"
      );
    }

    let takeProfitPrice;
    let stopLossPrice;

    if (
      this.direction ===
      "LONG"
    ) {
      takeProfitPrice =
        entryPrice *
        (1 + this.tpPercent / 100);

      stopLossPrice =
        entryPrice *
        (1 - this.slPercent / 100);
    } else {
      takeProfitPrice =
        entryPrice *
        (1 - this.tpPercent / 100);

      stopLossPrice =
        entryPrice *
        (1 + this.slPercent / 100);
    }

    this.position = {
      status: "OPEN",

      direction:
        this.direction,

      entryPrice,

      currentPrice:
        entryPrice,

      takeProfitPrice,

      stopLossPrice,

      openedAt:
        new Date().toISOString(),

      closedAt: null,

      exitPrice: null,

      exitReason: null,
    };

    this.lastDecision =
      "POSITION_OPEN";

    console.log(
      `[Bot:${this.id}] PAPER ` +
        `${this.direction} OPEN ` +
        `Entry=${entryPrice} ` +
        `TP=${takeProfitPrice} ` +
        `SL=${stopLossPrice}`
    );

    this.notifyStateChange();
  }

  // =========================================================
  // POSITION MONITOR
  // =========================================================

  startPositionMonitor() {
    if (this.positionTimer) {
      clearInterval(
        this.positionTimer
      );
    }

    this.positionTimer =
      setInterval(() => {
        this.monitorPosition();
      }, 5000);
  }

  async monitorPosition() {
    if (
      this.status !==
      "RUNNING"
    ) {
      return;
    }

    if (
      this.position.status !==
      "OPEN"
    ) {
      return;
    }

    try {
      const ticker =
        await getTicker(
          this.symbol
        );

      const currentPrice =
        Number(
          ticker.bidPrice ??
            ticker.askPrice ??
            ticker.lastPrice ??
            ticker.price
        );

      if (
        !Number.isFinite(
          currentPrice
        ) ||
        currentPrice <= 0
      ) {
        return;
      }

      this.position.currentPrice =
        currentPrice;

      this.lastPrice =
        currentPrice;

      const {
        direction,
        takeProfitPrice,
        stopLossPrice,
      } = this.position;

      this.notifyStateChange();

      // =======================================================
      // LONG TP / SL
      // =======================================================

      if (
        direction ===
        "LONG"
      ) {
        if (
          currentPrice >=
          takeProfitPrice
        ) {
          await this.closePaperPosition(
            currentPrice,
            "TAKE_PROFIT"
          );

          return;
        }

        if (
          currentPrice <=
          stopLossPrice
        ) {
          await this.closePaperPosition(
            currentPrice,
            "STOP_LOSS"
          );

          return;
        }
      }

      // =======================================================
      // SHORT TP / SL
      // =======================================================

      if (
        direction ===
        "SHORT"
      ) {
        if (
          currentPrice <=
          takeProfitPrice
        ) {
          await this.closePaperPosition(
            currentPrice,
            "TAKE_PROFIT"
          );

          return;
        }

        if (
          currentPrice >=
          stopLossPrice
        ) {
          await this.closePaperPosition(
            currentPrice,
            "STOP_LOSS"
          );

          return;
        }
      }
    } catch (error) {
      console.error(
        `[Bot:${this.id}] ` +
          `Position monitor error:`,
        error.message
      );
    }
  }

  // =========================================================
  // PAPER POSITION CLOSE
  // =========================================================

  async closePaperPosition(
    exitPrice,
    reason
  ) {
    if (
      this.position.status !==
      "OPEN"
    ) {
      return;
    }

    const entryPrice =
      this.position.entryPrice;

    let pnlPercent = 0;

    if (
      this.position.direction ===
      "LONG"
    ) {
      pnlPercent =
        ((exitPrice -
          entryPrice) /
          entryPrice) *
        100;
    } else {
      pnlPercent =
        ((entryPrice -
          exitPrice) /
          entryPrice) *
        100;
    }

    const trade = {
      tradeNumber:
        this.tradeHistory.length +
        1,

      symbol:
        this.symbol,

      direction:
        this.position.direction,

      entryPrice,

      exitPrice,

      pnlPercent:
        Number(
          pnlPercent.toFixed(4)
        ),

      result:
        pnlPercent > 0
          ? "WIN"
          : pnlPercent < 0
          ? "LOSS"
          : "BREAKEVEN",

      reason,

      openedAt:
        this.position.openedAt,

      closedAt:
        new Date().toISOString(),
    };

    this.tradeHistory.push(
      trade
    );

    this.lastTrade =
      trade;

    this.position.closedAt =
      trade.closedAt;

    this.position.exitPrice =
      exitPrice;

    this.position.exitReason =
      reason;

    this.position.status =
      "FLAT";

    this.position.currentPrice =
      exitPrice;

    this.position.direction =
      null;

    this.position.entryPrice =
      null;

    this.position.takeProfitPrice =
      null;

    this.position.stopLossPrice =
      null;

    this.lastDecision =
      "WAIT";

    console.log(
      `[Bot:${this.id}] PAPER ` +
        `${reason} ` +
        `Entry=${entryPrice} ` +
        `Exit=${exitPrice} ` +
        `PnL=${trade.pnlPercent}%`
    );

    this.notifyStateChange();
  }

  // =========================================================
  // STATISTICS
  // =========================================================

  getStatistics() {
    const totalTrades =
      this.tradeHistory.length;

    const wins =
      this.tradeHistory.filter(
        (trade) =>
          trade.pnlPercent > 0
      ).length;

    const losses =
      this.tradeHistory.filter(
        (trade) =>
          trade.pnlPercent < 0
      ).length;

    const breakeven =
      this.tradeHistory.filter(
        (trade) =>
          trade.pnlPercent === 0
      ).length;

    const realizedPnl =
      this.tradeHistory.reduce(
        (total, trade) =>
          total +
          trade.pnlPercent,
        0
      );

    const winRate =
      totalTrades > 0
        ? (wins /
            totalTrades) *
          100
        : 0;

    return {
      totalTrades,

      wins,

      losses,

      breakeven,

      winRate:
        Number(
          winRate.toFixed(2)
        ),

      realizedPnl:
        Number(
          realizedPnl.toFixed(4)
        ),
    };
  }

  // =========================================================
  // STATE
  // =========================================================

  getState() {
    return {
      id: this.id,

      symbol:
        this.symbol,

      direction:
        this.direction,

      entryModel:
        this.entryModel,

      tpPercent:
        this.tpPercent,

      slPercent:
        this.slPercent,

      rsi: {
        period:
          this.rsiPeriod,

        longEntry:
          this.rsiLongEntry,

        shortEntry:
          this.rsiShortEntry,
      },

      status:
        this.status,

      lastPrice:
        this.lastPrice,

      lastRSI:
        this.lastRSI,

      lastDecision:
        this.lastDecision,

      lastReason:
        this.lastReason,

      lastScanAt:
        this.lastScanAt,

      lastProcessedCandleTime:
        this.lastProcessedCandleTime,

      lastProcessedCandleAt:
        this.lastProcessedCandleAt,

      position: {
        ...this.position,
      },

      statistics:
        this.getStatistics(),

      lastTrade:
        this.lastTrade,

      tradeHistory:
        this.tradeHistory,

      createdAt:
        this.createdAt,

      startedAt:
        this.startedAt,
    };
  }
}

module.exports = SimpleBot;

