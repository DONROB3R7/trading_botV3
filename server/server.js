const path = require("path");
const fs = require("fs");

// ============================================================
// ENVIRONMENT
// ============================================================

// server.js:
// project/server/server.js
//
// .env:
// project/.env

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

const express = require("express");
const cors = require("cors");

// ============================================================
// MARKET DATA
// ============================================================

const {
  getTradingSymbols,
  getExchangeInfo,
  getTicker,
  getKlines,
  getAccountBalance,
} = require("./market/marketData");

const {
  getOrderBook,
} = require("./market/orderBookData");

// ============================================================
// BOT SYSTEM
// ============================================================

const BotManager =
  require("./bot/BotManager");

const OrderBookModule =
  require("./modules/orderBook");

// ============================================================
// EXECUTION
// ============================================================

const {
  calculateOrder,
} = require("./execution/orderCalculator");

const WeexExecution =
  require("./execution/weexExecution");

// ============================================================
// APP
// ============================================================

const app =
  express();

const PORT =
  3001;

app.use(
  cors()
);

app.use(
  express.json()
);

// ============================================================
// WEEX EXECUTION INSTANCE
// ============================================================

const weexExecution =
  new WeexExecution({
    apiKey:
      process.env.WEEX_API_KEY,

    secretKey:
      process.env.WEEX_API_SECRET,

    passphrase:
      process.env.WEEX_API_PASSPHRASE,
  });

// ============================================================
// BOT MANAGER
// ============================================================

const botManager =
  new BotManager();

// ============================================================
// GLOBAL SETTINGS
// ============================================================

const SETTINGS_DIR =
  path.resolve(
    __dirname,
    "./data"
  );

const SETTINGS_FILE =
  path.resolve(
    SETTINGS_DIR,
    "settings.json"
  );

const DEFAULT_SETTINGS = {
  marginUSDT:
    0.5,

  leverage:
    10,
};

// ============================================================
// SETTINGS HELPERS
// ============================================================

function ensureSettingsFile() {
  if (
    !fs.existsSync(
      SETTINGS_DIR
    )
  ) {
    fs.mkdirSync(
      SETTINGS_DIR,
      {
        recursive:
          true,
      }
    );
  }

  if (
    !fs.existsSync(
      SETTINGS_FILE
    )
  ) {
    fs.writeFileSync(
      SETTINGS_FILE,
      JSON.stringify(
        DEFAULT_SETTINGS,
        null,
        2
      ),
      "utf8"
    );
  }
}

function loadSettings() {
  ensureSettingsFile();

  try {
    const raw =
      fs.readFileSync(
        SETTINGS_FILE,
        "utf8"
      );

    const saved =
      JSON.parse(raw);

    return {
      ...DEFAULT_SETTINGS,
      ...saved,
    };

  } catch (error) {
    console.error(
      "[Settings] Failed to load settings:",
      error.message
    );

    return {
      ...DEFAULT_SETTINGS,
    };
  }
}

function saveSettings(
  settings
) {
  ensureSettingsFile();

  fs.writeFileSync(
    SETTINGS_FILE,
    JSON.stringify(
      settings,
      null,
      2
    ),
    "utf8"
  );
}

let globalSettings =
  loadSettings();

console.log(
  `[Settings] Margin = ${globalSettings.marginUSDT} USDT`
);

console.log(
  `[Settings] Leverage = ${globalSettings.leverage}x`
);

// ============================================================
// HEALTH
// ============================================================

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      success:
        true,

      status:
        "OK",

      service:
        "WEEX BOT LAB",

      time:
        new Date().toISOString(),
    });
  }
);

// ============================================================
// WEEX POSITION TEST
// ============================================================

app.get(
  "/api/weex/position-test",
  async (req, res) => {
    try {
      const symbol =
        String(
          req.query.symbol ||
          "POLUSDT"
        )
          .trim()
          .toUpperCase();

      const positionSide =
        String(
          req.query.positionSide ||
          "LONG"
        )
          .trim()
          .toUpperCase();

      const result =
        await weexExecution.getPosition({
          symbol,
          positionSide,
        });

      res.json({
        success:
          true,

        result,
      });

    } catch (error) {
      console.error(
        "[WEEX Position Test]",
        error
      );

      res.status(500).json({
        success:
          false,

        error:
          error.message,
      });
    }
  }
);

// ============================================================
// WEEX DIRECT SL DEBUG TEST
// ============================================================
//
// TEMPORARY TEST ROUTE.
//
// This bypasses AdvancedBot completely.
//
// Example:
//
// http://localhost:3001/api/weex/debug-sl?symbol=POLUSDT&positionSide=LONG&triggerPrice=0.1071924
//
// IMPORTANT:
// This sends a REAL authenticated WEEX SL request.
//
// Do NOT call this repeatedly.
// Use it only to diagnose the current open position.
//

app.get(
  "/api/weex/debug-sl",
  async (req, res) => {
    try {
      const symbol =
        String(
          req.query.symbol ||
          "POLUSDT"
        )
          .trim()
          .toUpperCase();

      const positionSide =
        String(
          req.query.positionSide ||
          "LONG"
        )
          .trim()
          .toUpperCase();

      const triggerPrice =
        Number(
          req.query.triggerPrice
        );

      // --------------------------------------------------------
      // VALIDATION
      // --------------------------------------------------------

      if (
        !symbol
      ) {
        return res.status(400).json({
          success:
            false,

          error:
            "symbol is required",
        });
      }

      if (
        positionSide !==
          "LONG" &&
        positionSide !==
          "SHORT"
      ) {
        return res.status(400).json({
          success:
            false,

          error:
            "positionSide must be LONG or SHORT",
        });
      }

      if (
        !Number.isFinite(
          triggerPrice
        ) ||
        triggerPrice <= 0
      ) {
        return res.status(400).json({
          success:
            false,

          error:
            "triggerPrice must be a valid number greater than 0",
        });
      }

      // --------------------------------------------------------
      // SAFETY LOG
      // --------------------------------------------------------

      console.log("");
      console.log(
        "============================================================"
      );

      console.log(
        "[SERVER] DIRECT WEEX SL DEBUG REQUEST"
      );

      console.log(
        "============================================================"
      );

      console.log(
        `[SERVER] Symbol=${symbol}`
      );

      console.log(
        `[SERVER] Position Side=${positionSide}`
      );

      console.log(
        `[SERVER] Trigger Price=${triggerPrice}`
      );

      console.log(
        "[SERVER] Sending request directly to WEEX..."
      );

      console.log(
        "============================================================"
      );

      // --------------------------------------------------------
      // DIRECT WEEX SL TEST
      // --------------------------------------------------------

      const result =
        await weexExecution.debugPlaceStopLoss({
          symbol,
          positionSide,
          triggerPrice,
        });

      // --------------------------------------------------------
      // RESPONSE
      // --------------------------------------------------------

      console.log(
        "[SERVER] DIRECT WEEX SL RESULT:"
      );

      console.log(
        JSON.stringify(
          result,
          null,
          2
        )
      );

      console.log(
        "============================================================"
      );

      res.json({
        success:
          true,

        test:
          "DIRECT_WEEX_STOP_LOSS",

        symbol,

        positionSide,

        triggerPrice,

        result,
      });

    } catch (error) {
      console.error(
        "[WEEX Direct SL Debug]",
        error
      );

      res.status(500).json({
        success:
          false,

        error:
          error.message,
      });
    }
  }
);

// ============================================================
// GLOBAL SETTINGS
// ============================================================

app.get(
  "/api/settings",
  (req, res) => {
    try {
      res.json({
        success:
          true,

        data:
          globalSettings,
      });

    } catch (error) {
      console.error(
        "[Settings GET]",
        error.message
      );

      res.status(500).json({
        success:
          false,

        error:
          error.message,
      });
    }
  }
);

app.put(
  "/api/settings",
  (req, res) => {
    try {
      const {
        marginUSDT,
        leverage,
      } = req.body;

      const finalMargin =
        Number(
          marginUSDT
        );

      const finalLeverage =
        Number(
          leverage
        );

      if (
        !Number.isFinite(
          finalMargin
        ) ||
        finalMargin <= 0
      ) {
        return res.status(400).json({
          success:
            false,

          error:
            "marginUSDT must be greater than 0",
        });
      }

      if (
        !Number.isFinite(
          finalLeverage
        ) ||
        finalLeverage <= 0
      ) {
        return res.status(400).json({
          success:
            false,

          error:
            "leverage must be greater than 0",
        });
      }

      globalSettings = {
        marginUSDT:
          finalMargin,

        leverage:
          finalLeverage,
      };

      saveSettings(
        globalSettings
      );

      console.log(
        `[Settings] Updated | margin=${finalMargin} USDT | leverage=${finalLeverage}x`
      );

      res.json({
        success:
          true,

        data:
          globalSettings,
      });

    } catch (error) {
      console.error(
        "[Settings PUT]",
        error.message
      );

      res.status(500).json({
        success:
          false,

        error:
          error.message,
      });
    }
  }
);

// ============================================================
// MARKET DATA
// ============================================================

// ------------------------------------------------------------
// Trading symbols
// ------------------------------------------------------------

app.get(
  "/api/market/symbols",
  async (req, res) => {
    try {
      const data =
        await getTradingSymbols();

      res.json({
        success:
          true,

        data,
      });

    } catch (error) {
      console.error(
        "[Market Symbols]",
        error.message
      );

      res.status(500).json({
        success:
          false,

        error:
          error.message,
      });
    }
  }
);

// ------------------------------------------------------------
// Exchange info
// ------------------------------------------------------------

app.get(
  "/api/market/exchange-info",
  async (req, res) => {
    try {
      const symbol =
        req.query.symbol ||
        "";

      const data =
        await getExchangeInfo(
          symbol
        );

      res.json({
        success:
          true,

        data,
      });

    } catch (error) {
      console.error(
        "[Exchange Info]",
        error.message
      );

      res.status(500).json({
        success:
          false,

        error:
          error.message,
      });
    }
  }
);

// ------------------------------------------------------------
// Ticker
// ------------------------------------------------------------

app.get(
  "/api/market/ticker/:symbol",
  async (req, res) => {
    try {
      const symbol =
        req.params.symbol
          .toUpperCase();

      const data =
        await getTicker(
          symbol
        );

      res.json({
        success:
          true,

        symbol,

        data,
      });

    } catch (error) {
      console.error(
        "[Ticker]",
        error.message
      );

      res.status(500).json({
        success:
          false,

        error:
          error.message,
      });
    }
  }
);

// ------------------------------------------------------------
// Klines
// ------------------------------------------------------------

app.get(
  "/api/market/klines/:symbol",
  async (req, res) => {
    try {
      const symbol =
        req.params.symbol
          .toUpperCase();

      const interval =
        req.query.interval ||
        "15m";

      const limit =
        Number(
          req.query.limit ||
          100
        );

      const data =
        await getKlines(
          symbol,
          interval,
          limit
        );

      res.json({
        success:
          true,

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
        success:
          false,

        error:
          error.message,
      });
    }
  }
);

// ============================================================
// WEEX ACCOUNT
// ============================================================

app.get(
  "/api/weex/account",
  async (req, res) => {
    try {
      const data =
        await getAccountBalance();

      console.log(
        "[WEEX] Authentication OK"
      );

      res.json({
        success:
          true,

        data,
      });

    } catch (error) {
      console.error(
        "[WEEX Account]",
        error.message
      );

      res.status(500).json({
        success:
          false,

        error:
          error.message,
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
        req.params.symbol
          .toUpperCase();

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
        success:
          true,

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
        success:
          false,

        error:
          error.message,
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
        success:
          true,

        data:
          botManager.getAllBots(),
      });

    } catch (error) {
      console.error(
        "[Bots]",
        error.message
      );

      res.status(500).json({
        success:
          false,

        error:
          error.message,
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
          success:
            false,

          error:
            "Symbol is required",
        });
      }

      if (
        direction !==
          "LONG" &&
        direction !==
          "SHORT"
      ) {
        return res.status(400).json({
          success:
            false,

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
        success:
          true,

        data:
          typeof bot?.getState ===
            "function"
            ? bot.getState()
            : bot,
      });

    } catch (error) {
      console.error(
        "[Create Simple Bot]",
        error.message
      );

      res.status(500).json({
        success:
          false,

        error:
          error.message,
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

        // ORDER BOOK

        longMinImbalance,
        shortMaxImbalance,
        minBidAskRatio,
        minAskBidRatio,

        counterTrendRequired,

        // CYCLE

        cycleMinutes,
        cycleIntervalMs,
        cycleTriggerMinutes,

        // PYRAMIDING

        maxEntries,

        // TP / SL

        tpPercent,
        slPercent,

        // KILL ZONE

        killZoneEnabled,
        killZoneLow,
        killZoneHigh,

        // TRIGGER LINE

        triggerLineEnabled,
        triggerLinePrice,
      } = req.body;

      // --------------------------------------------------------
      // BASIC VALIDATION
      // --------------------------------------------------------

      if (!symbol) {
        return res.status(400).json({
          success:
            false,

          error:
            "Symbol is required",
        });
      }

      if (
        direction !==
          "LONG" &&
        direction !==
          "SHORT"
      ) {
        return res.status(400).json({
          success:
            false,

          error:
            "Direction must be LONG or SHORT",
        });
      }

      // --------------------------------------------------------
      // ORDER BOOK DEFAULTS
      // --------------------------------------------------------

      const finalLongMinImbalance =
        Number(
          longMinImbalance ??
          0.005
        );

      const finalShortMaxImbalance =
        Number(
          shortMaxImbalance ??
          -0.005
        );

      const finalMinBidAskRatio =
        Number(
          minBidAskRatio ??
          0.90
        );

      const finalMinAskBidRatio =
        Number(
          minAskBidRatio ??
          0.90
        );

      const finalCounterTrendRequired =
        Number(
          counterTrendRequired ??
          3
        );

      // --------------------------------------------------------
      // CYCLE DEFAULTS
      // --------------------------------------------------------

      const finalCycleMinutes =
        Number(
          cycleMinutes ??
          10
        );

      const finalCycleIntervalMs =
        Number(
          cycleIntervalMs ??
          60 * 1000
        );

      const finalCycleTriggerMinutes =
        Number(
          cycleTriggerMinutes ??
          3
        );

      // --------------------------------------------------------
      // PYRAMID DEFAULT
      // --------------------------------------------------------

      const finalMaxEntries =
        Number(
          maxEntries ??
          3
        );

      // --------------------------------------------------------
      // TP / SL
      // --------------------------------------------------------

      const finalTpPercent =
        Number(
          tpPercent ??
          1
        );

      const finalSlPercent =
        Number(
          slPercent ??
          0.8
        );

      // --------------------------------------------------------
      // KILL ZONE
      // --------------------------------------------------------

      const finalKillZoneEnabled =
        Boolean(
          killZoneEnabled ??
          false
        );

      const finalKillZoneLow =
        killZoneLow !== undefined &&
        killZoneLow !== null &&
        killZoneLow !== ""
          ? Number(
              killZoneLow
            )
          : null;

      const finalKillZoneHigh =
        killZoneHigh !== undefined &&
        killZoneHigh !== null &&
        killZoneHigh !== ""
          ? Number(
              killZoneHigh
            )
          : null;

      // --------------------------------------------------------
      // TRIGGER LINE
      // --------------------------------------------------------

      const finalTriggerLineEnabled =
        Boolean(
          triggerLineEnabled ??
          false
        );

      const finalTriggerLinePrice =
        triggerLinePrice !== undefined &&
        triggerLinePrice !== null &&
        triggerLinePrice !== ""
          ? Number(
              triggerLinePrice
            )
          : null;

      // --------------------------------------------------------
      // VALIDATION
      // --------------------------------------------------------

      if (
        !Number.isFinite(
          finalCycleMinutes
        ) ||
        finalCycleMinutes <= 0
      ) {
        return res.status(400).json({
          success:
            false,

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
          success:
            false,

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
          success:
            false,

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
          success:
            false,

          error:
            "maxEntries must be at least 1",
        });
      }

      if (
        finalMaxEntries >
        3
      ) {
        return res.status(400).json({
          success:
            false,

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
          success:
            false,

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
          success:
            false,

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
          success:
            false,

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
          success:
            false,

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
          success:
            false,

          error:
            "triggerLinePrice must be a valid number",
        });
      }

      // --------------------------------------------------------
      // DEBUG
      // --------------------------------------------------------

      console.log(
        "[Create Advanced Bot] Trigger Line:",
        {
          enabled:
            finalTriggerLineEnabled,

          price:
            finalTriggerLinePrice,
        }
      );

      // --------------------------------------------------------
      // CREATE
      // --------------------------------------------------------

      const bot =
        botManager.createAdvancedBot({
          symbol,
          direction,

          entryModel:
            "ORDERBOOK",

          // Global Position Settings

          marginUSDT:
            globalSettings.marginUSDT,

          leverage:
            globalSettings.leverage,

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
        `[BotManager] Advanced Bot Position | margin=${globalSettings.marginUSDT} USDT | leverage=${globalSettings.leverage}x`
      );

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
        `[AdvancedBot] TP = ${finalTpPercent}%`
      );

      console.log(
        `[AdvancedBot] SL = ${finalSlPercent}%`
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
        success:
          true,

        data:
          typeof bot?.getState ===
            "function"
            ? bot.getState()
            : bot,
      });

    } catch (error) {
      console.error(
        "[Create Advanced Bot]",
        error.message
      );

      res.status(500).json({
        success:
          false,

        error:
          error.message,
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
          success:
            false,

          error:
            "Bot not found",
        });
      }

      if (
        bot.botType !==
        "ADVANCED"
      ) {
        return res.status(400).json({
          success:
            false,

          error:
            "Manual scan is only available for Advanced Bot",
        });
      }

      const result =
        await bot.scanNow();

      res.json({
        success:
          true,

        data:
          result,
      });

    } catch (error) {
      console.error(
        "[Advanced Scan]",
        error.message
      );

      res.status(500).json({
        success:
          false,

        error:
          error.message,
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
          success:
            false,

          error:
            "Bot not found",
        });
      }

      botManager.startBot(
        req.params.id
      );

      const state =
        typeof bot.getState ===
          "function"
          ? bot.getState()
          : bot;

      res.json({
        success:
          true,

        data:
          state,
      });

    } catch (error) {
      console.error(
        "[Start Bot]",
        error.message
      );

      res.status(400).json({
        success:
          false,

        error:
          error.message,
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
          success:
            false,

          error:
            "Bot not found",
        });
      }

      botManager.stopBot(
        req.params.id
      );

      const state =
        typeof bot.getState ===
          "function"
          ? bot.getState()
          : bot;

      res.json({
        success:
          true,

        data:
          state,
      });

    } catch (error) {
      console.error(
        "[Stop Bot]",
        error.message
      );

      res.status(400).json({
        success:
          false,

        error:
          error.message,
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
          success:
            false,

          error:
            "Bot not found",
        });
      }

      botManager.removeBot(
        req.params.id
      );

      res.json({
        success:
          true,
      });

    } catch (error) {
      console.error(
        "[Delete Bot]",
        error.message
      );

      res.status(400).json({
        success:
          false,

        error:
          error.message,
      });
    }
  }
);

// ============================================================
// ORDER CALCULATION
// ============================================================

app.get(
  "/api/order-calculation/:symbol",
  async (req, res) => {
    try {
      const symbol =
        String(
          req.params.symbol ||
          ""
        )
          .toUpperCase();

      const result =
        await calculateOrder(
          symbol,
          globalSettings.marginUSDT,
          globalSettings.leverage
        );

      res.json({
        success:
          true,

        data:
          result,
      });

    } catch (error) {
      console.error(
        "[Order Calculation]",
        error.message
      );

      res.status(500).json({
        success:
          false,

        error:
          error.message,
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
      success:
        false,

      error:
        "API route not found",
    });
  }
);

// ============================================================
// ERROR HANDLER
// ============================================================

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "[Server Error]",
      error
    );

    res.status(500).json({
      success:
        false,

      error:
        error.message ||
        "Internal server error",
    });
  }
);

// ============================================================
// START SERVER
// ============================================================

app.listen(
  PORT,
  () => {
    console.log(
      "\n=========================================="
    );

    console.log(
      "WEEX BOT LAB SERVER"
    );

    console.log(
      "=========================================="
    );

    console.log(
      `Running on http://localhost:${PORT}`
    );

    console.log(
      "Advanced Order Book: 200 trend / 15-20-30-60 entry"
    );

    console.log(
      "Advanced Cycle: 10 minutes / 1-minute scans / 3 trigger minutes"
    );

    console.log(
      "Advanced Pyramiding: maximum 3 entries"
    );

    console.log(
      `Advanced TP default: 1%`
    );

    console.log(
      `Advanced SL default: 0.8%`
    );

    console.log(
      `[Settings] Margin = ${globalSettings.marginUSDT} USDT`
    );

    console.log(
      `[Settings] Leverage = ${globalSettings.leverage}x`
    );

    console.log(
      `[ENV] WEEX_API_KEY = ${
        process.env.WEEX_API_KEY
          ? "LOADED"
          : "MISSING"
      }`
    );

    console.log(
      `[ENV] WEEX_API_SECRET = ${
        process.env.WEEX_API_SECRET
          ? "LOADED"
          : "MISSING"
      }`
    );

    console.log(
      `[ENV] WEEX_API_PASSPHRASE = ${
        process.env.WEEX_API_PASSPHRASE
          ? "LOADED"
          : "MISSING"
      }`
    );

    console.log(
      "==========================================\n"
    );
  }
);