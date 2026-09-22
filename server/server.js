const express = require("express");
const cors = require("cors");

const {
  getTradingSymbols,
  getExchangeInfo,
  getTicker,
  getKlines,
} = require("./market/marketData");

const {
  getOrderBook,
} = require("./market/orderBookData");

const BotManager =
  require("./bot/BotManager");

const OrderBookModule =
  require("./modules/orderBook");

const app = express();

const PORT = 3001;

app.use(cors());
app.use(express.json());

const botManager =
  new BotManager();

// ============================================================
// HEALTH
// ============================================================

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      success: true,
      status: "OK",
      service: "WEEX BOT LAB",
      time: new Date().toISOString(),
    });
  }
);

// ============================================================
// MARKET DATA
// ============================================================

// WEEX trading symbols

app.get(
  "/api/market/symbols",
  async (req, res) => {
    try {
      const data =
        await getTradingSymbols();

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      console.error(
        "[Market Symbols]",
        error.message
      );

      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// WEEX exchange info

app.get(
  "/api/market/exchange-info",
  async (req, res) => {
    try {
      const symbol =
        req.query.symbol || "";

      const data =
        await getExchangeInfo(
          symbol
        );

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      console.error(
        "[Exchange Info]",
        error.message
      );

      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// Ticker

app.get(
  "/api/market/ticker/:symbol",
  async (req, res) => {
    try {
      const symbol =
        req.params.symbol.toUpperCase();

      const data =
        await getTicker(
          symbol
        );

      res.json({
        success: true,
        symbol,
        data,
      });
    } catch (error) {
      console.error(
        "[Ticker]",
        error.message
      );

      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// Klines

app.get(
  "/api/market/klines/:symbol",
  async (req, res) => {
    try {
      const symbol =
        req.params.symbol.toUpperCase();

      const interval =
        req.query.interval ||
        "15m";

      const limit =
        Number(
          req.query.limit || 100
        );

      const data =
        await getKlines(
          symbol,
          interval,
          limit
        );

      res.json({
        success: true,
        symbol,
        interval,
        limit,
        data,
      });
    } catch (error) {
      console.error(
        "[Klines]",
        error.message
      );

      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// ============================================================
// ORDER BOOK
// ============================================================

app.get(
  "/api/market/orderbook/:symbol",
  async (req, res) => {
    try {
      const symbol =
        req.params.symbol.toUpperCase();

      const snapshot =
        await getOrderBook(
          symbol,
          200
        );

      const orderBook =
        new OrderBookModule();

      const analysis =
        orderBook.analyze(
          snapshot
        );

      res.json({
        success: true,
        symbol,

        data: {
          ...snapshot,
          analysis,
        },
      });
    } catch (error) {
      console.error(
        "[OrderBook]",
        error.message
      );

      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// ============================================================
// BOTS
// ============================================================

app.get(
  "/api/bots",
  (req, res) => {
    try {
      res.json({
        success: true,
        data:
          botManager.getAllBots(),
      });
    } catch (error) {
      console.error(
        "[Bots]",
        error.message
      );

      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// ============================================================
// CREATE SIMPLE BOT
// ============================================================

app.post(
  "/api/bots",
  (req, res) => {
    try {
      const {
        symbol,
        direction,
        entryModel,
        tpPercent,
        slPercent,
        rsiPeriod,
        rsiLongEntry,
        rsiShortEntry,
      } = req.body;

      if (!symbol) {
        return res.status(400).json({
          success: false,
          error:
            "Symbol is required",
        });
      }

      if (
        direction !== "LONG" &&
        direction !== "SHORT"
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Direction must be LONG or SHORT",
        });
      }

      const bot =
        botManager.createBot({
          symbol,
          direction,
          entryModel,
          tpPercent,
          slPercent,
          rsiPeriod,
          rsiLongEntry,
          rsiShortEntry,
        });

      res.json({
        success: true,
        data:
          typeof bot?.getState === "function"
            ? bot.getState()
            : bot,
      });
    } catch (error) {
      console.error(
        "[Create Simple Bot]",
        error.message
      );

      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// ============================================================
// CREATE ADVANCED BOT
// ============================================================

app.post(
  "/api/advanced-bots",
  (req, res) => {
    try {
      const {
        symbol,
        direction,

        // ------------------------------------------
        // ORDER BOOK
        // ------------------------------------------

        longMinImbalance,
        shortMaxImbalance,
        minBidAskRatio,
        minAskBidRatio,

        counterTrendRequired,

        // ------------------------------------------
        // CYCLE
        // ------------------------------------------

        cycleMinutes,
        cycleIntervalMs,
        cycleTriggerMinutes,

        // ------------------------------------------
        // PYRAMIDING
        // ------------------------------------------

        maxEntries,

        // ------------------------------------------
        // TP / SL
        // ------------------------------------------

        tpPercent,
        slPercent,

        // ------------------------------------------
        // KILL ZONE
        // ------------------------------------------

        killZoneEnabled,
        killZoneLow,
        killZoneHigh,

        // ------------------------------------------
        // TRIGGER LINE
        // ------------------------------------------

        triggerLineEnabled,
        triggerLinePrice,
      } = req.body;

      // ------------------------------------------------
      // BASIC VALIDATION
      // ------------------------------------------------

      if (!symbol) {
        return res.status(400).json({
          success: false,
          error:
            "Symbol is required",
        });
      }

      if (
        direction !== "LONG" &&
        direction !== "SHORT"
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Direction must be LONG or SHORT",
        });
      }

      // ------------------------------------------------
      // ORDER BOOK DEFAULTS
      // ------------------------------------------------

      const finalLongMinImbalance =
        Number(
          longMinImbalance ?? 0.005
        );

      const finalShortMaxImbalance =
        Number(
          shortMaxImbalance ?? -0.005
        );

      const finalMinBidAskRatio =
        Number(
          minBidAskRatio ?? 0.90
        );

      const finalMinAskBidRatio =
        Number(
          minAskBidRatio ?? 0.90
        );

      const finalCounterTrendRequired =
        Number(
          counterTrendRequired ?? 3
        );

      // ------------------------------------------------
      // CYCLE DEFAULTS
      // ------------------------------------------------

      const finalCycleMinutes =
        Number(
          cycleMinutes ?? 10
        );

      const finalCycleIntervalMs =
        Number(
          cycleIntervalMs ??
            60 * 1000
        );

      const finalCycleTriggerMinutes =
        Number(
          cycleTriggerMinutes ?? 3
        );

      // ------------------------------------------------
      // PYRAMID DEFAULT
      // ------------------------------------------------

      const finalMaxEntries =
        Number(
          maxEntries ?? 3
        );

      // ------------------------------------------------
      // TP / SL DEFAULTS
      // ------------------------------------------------

      const finalTpPercent =
        Number(
          tpPercent ?? 1
        );

      const finalSlPercent =
        Number(
          slPercent ?? 0.8
        );

      // ------------------------------------------------
      // KILL ZONE
      // ------------------------------------------------

      const finalKillZoneEnabled =
        Boolean(
          killZoneEnabled ?? false
        );

      const finalKillZoneLow =
        killZoneLow !== undefined &&
        killZoneLow !== null &&
        killZoneLow !== ""
          ? Number(killZoneLow)
          : null;

      const finalKillZoneHigh =
        killZoneHigh !== undefined &&
        killZoneHigh !== null &&
        killZoneHigh !== ""
          ? Number(killZoneHigh)
          : null;

      // ------------------------------------------------
      // TRIGGER LINE
      // ------------------------------------------------

      const finalTriggerLineEnabled =
        Boolean(
          triggerLineEnabled ?? false
        );

      const finalTriggerLinePrice =
        triggerLinePrice !== undefined &&
        triggerLinePrice !== null &&
        triggerLinePrice !== ""
          ? Number(triggerLinePrice)
          : null;

      // ------------------------------------------------
      // VALIDATION
      // ------------------------------------------------

      if (
        !Number.isFinite(
          finalCycleMinutes
        ) ||
        finalCycleMinutes <= 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "cycleMinutes must be greater than 0",
        });
      }

      if (
        !Number.isFinite(
          finalCycleIntervalMs
        ) ||
        finalCycleIntervalMs <= 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "cycleIntervalMs must be greater than 0",
        });
      }

      if (
        !Number.isFinite(
          finalCycleTriggerMinutes
        ) ||
        finalCycleTriggerMinutes < 1 ||
        finalCycleTriggerMinutes >
          finalCycleMinutes
      ) {
        return res.status(400).json({
          success: false,
          error:
            "cycleTriggerMinutes must be between 1 and cycleMinutes",
        });
      }

      if (
        !Number.isFinite(
          finalMaxEntries
        ) ||
        finalMaxEntries < 1
      ) {
        return res.status(400).json({
          success: false,
          error:
            "maxEntries must be at least 1",
        });
      }

      if (
        finalMaxEntries > 3
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Advanced Bot maximum pyramiding entries is 3",
        });
      }

      if (
        !Number.isFinite(
          finalCounterTrendRequired
        ) ||
        finalCounterTrendRequired < 1 ||
        finalCounterTrendRequired > 4
      ) {
        return res.status(400).json({
          success: false,
          error:
            "counterTrendRequired must be between 1 and 4",
        });
      }

      if (
        finalKillZoneEnabled &&
        finalKillZoneLow === null &&
        finalKillZoneHigh === null
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Kill Zone is enabled but no price level or zone was provided",
        });
      }

      if (
        finalKillZoneLow !== null &&
        !Number.isFinite(
          finalKillZoneLow
        )
      ) {
        return res.status(400).json({
          success: false,
          error:
            "killZoneLow must be a valid number",
        });
      }

      if (
        finalKillZoneHigh !== null &&
        !Number.isFinite(
          finalKillZoneHigh
        )
      ) {
        return res.status(400).json({
          success: false,
          error:
            "killZoneHigh must be a valid number",
        });
      }

      if (
        finalTriggerLinePrice !== null &&
        !Number.isFinite(
          finalTriggerLinePrice
        )
      ) {
        return res.status(400).json({
          success: false,
          error:
            "triggerLinePrice must be a valid number",
        });
      }

      // ------------------------------------------------
      // DEBUG
      // ------------------------------------------------

      console.log(
        "[Create Advanced Bot] Trigger Line:",
        {
          enabled:
            finalTriggerLineEnabled,

          price:
            finalTriggerLinePrice,
        }
      );

      // ------------------------------------------------
      // CREATE
      // ------------------------------------------------

      const bot =
        botManager.createAdvancedBot({
          symbol,
          direction,

          entryModel:
            "ORDERBOOK",

          // Order Book
          longMinImbalance:
            finalLongMinImbalance,

          shortMaxImbalance:
            finalShortMaxImbalance,

          minBidAskRatio:
            finalMinBidAskRatio,

          minAskBidRatio:
            finalMinAskBidRatio,

          counterTrendRequired:
            finalCounterTrendRequired,

          // Cycle
          cycleMinutes:
            finalCycleMinutes,

          cycleIntervalMs:
            finalCycleIntervalMs,

          cycleTriggerMinutes:
            finalCycleTriggerMinutes,

          // Pyramiding
          maxEntries:
            finalMaxEntries,

          // TP / SL
          tpPercent:
            finalTpPercent,

          slPercent:
            finalSlPercent,

          // Kill Zone
          killZoneEnabled:
            finalKillZoneEnabled,

          killZoneLow:
            finalKillZoneLow,

          killZoneHigh:
            finalKillZoneHigh,

          // Trigger Line
          triggerLineEnabled:
            finalTriggerLineEnabled,

          triggerLinePrice:
            finalTriggerLinePrice,
        });

      console.log(
        `[AdvancedBot] Created ${bot.id}`
      );

      console.log(
        `[AdvancedBot] ${symbol} ${direction}`
      );

      console.log(
        `[AdvancedBot] Trend depth = 200`
      );

      console.log(
        `[AdvancedBot] Entry depths = 15/20/30/60`
      );

      console.log(
        `[AdvancedBot] Counter trend = ${finalCounterTrendRequired}/4`
      );

      console.log(
        `[AdvancedBot] Cycle = ${finalCycleMinutes} min`
      );

      console.log(
        `[AdvancedBot] Cycle trigger = ${finalCycleTriggerMinutes} minutes`
      );

      console.log(
        `[AdvancedBot] Pyramiding = ${finalMaxEntries} entries max`
      );

      console.log(
        `[AdvancedBot] Kill Zone = ${
          finalKillZoneEnabled
            ? "ON"
            : "OFF"
        }`
      );

      console.log(
        `[AdvancedBot] Trigger Line = ${
          finalTriggerLineEnabled
            ? "ON"
            : "OFF"
        }`
      );

      if (
        finalTriggerLinePrice !== null
      ) {
        console.log(
          `[AdvancedBot] Trigger Line configured price = ${finalTriggerLinePrice}`
        );
      }

      res.json({
        success: true,
        data:
          typeof bot?.getState === "function"
            ? bot.getState()
            : bot,
      });
    } catch (error) {
      console.error(
        "[Create Advanced Bot]",
        error.message
      );

      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// ============================================================
// MANUAL ADVANCED BOT SCAN
// ============================================================

app.post(
  "/api/bots/:id/scan",
  async (req, res) => {
    try {
      const bot =
        botManager.getBot(
          req.params.id
        );

      if (!bot) {
        return res.status(404).json({
          success: false,
          error:
            "Bot not found",
        });
      }

      if (
        bot.botType !==
        "ADVANCED"
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Manual scan is only available for Advanced Bot",
        });
      }

      const result =
        await bot.scanNow();

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error(
        "[Advanced Scan]",
        error.message
      );

      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// ============================================================
// START BOT
// ============================================================

app.post(
  "/api/bots/:id/start",
  (req, res) => {
    try {
      const bot =
        botManager.getBot(
          req.params.id
        );

      if (!bot) {
        return res.status(404).json({
          success: false,
          error:
            "Bot not found",
        });
      }

      botManager.startBot(
        req.params.id
      );

      // IMPORTANT:
      // Never return the live bot object here.
      // It contains Node.js Timeout objects from setInterval().
      //
      // getState() returns only JSON-safe frontend state.
      const state =
        typeof bot.getState === "function"
          ? bot.getState()
          : bot;

      res.json({
        success: true,
        data: state,
      });

    } catch (error) {
      console.error(
        "[Start Bot]",
        error.message
      );

      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// ============================================================
// STOP BOT
// ============================================================

app.post(
  "/api/bots/:id/stop",
  (req, res) => {
    try {
      const bot =
        botManager.getBot(
          req.params.id
        );

      if (!bot) {
        return res.status(404).json({
          success: false,
          error:
            "Bot not found",
        });
      }

      botManager.stopBot(
        req.params.id
      );

      // Return JSON-safe state instead of live bot object.
      const state =
        typeof bot.getState === "function"
          ? bot.getState()
          : bot;

      res.json({
        success: true,
        data: state,
      });

    } catch (error) {
      console.error(
        "[Stop Bot]",
        error.message
      );

      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// ============================================================
// DELETE BOT
// ============================================================

app.delete(
  "/api/bots/:id",
  (req, res) => {
    try {
      const bot =
        botManager.getBot(
          req.params.id
        );

      if (!bot) {
        return res.status(404).json({
          success: false,
          error:
            "Bot not found",
        });
      }

      botManager.removeBot(
        req.params.id
      );

      res.json({
        success: true,
      });
    } catch (error) {
      console.error(
        "[Delete Bot]",
        error.message
      );

      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// ============================================================
// 404
// ============================================================

app.use(
  (req, res) => {
    res.status(404).json({
      success: false,
      error:
        "API route not found",
    });
  }
);

// ============================================================
// ERROR HANDLER
// ============================================================

app.use(
  (error, req, res, next) => {
    console.error(
      "[Server Error]",
      error
    );

    res.status(500).json({
      success: false,
      error:
        error.message ||
        "Internal server error",
    });
  }
);

// ============================================================
// START
// ============================================================

app.listen(
  PORT,
  () => {
    console.log(
      `\nWEEX BOT LAB SERVER`
    );

    console.log(
      `Running on http://localhost:${PORT}`
    );

    console.log(
      `Advanced Order Book: 200 trend / 15-20-30-60 entry`
    );

    console.log(
      `Advanced Cycle: 10 minutes / 1-minute scans / 3 trigger minutes`
    );

    console.log(
      `Advanced Pyramiding: maximum 3 entries`
    );
  }
);