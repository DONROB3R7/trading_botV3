const SimpleBot = require("./SimpleBot");
const AdvancedBot = require("./AdvancedBot");

const storage = require("../storage/storage");

class BotManager {
  constructor() {
    this.bots = new Map();

    this.loadBots();
  }

  // ============================================================
  // LOAD
  // ============================================================

  loadBots() {
    try {
      const savedBots =
        storage.loadBots();

      if (!Array.isArray(savedBots)) {
        return;
      }

      for (const botData of savedBots) {
        try {
          const bot =
            this.createBotInstance(
              botData,
              false
            );

          this.bots.set(
            bot.id,
            bot
          );
        } catch (error) {
          console.error(
            `[BotManager] Failed to load bot ${
              botData?.id || "UNKNOWN"
            }:`,
            error.message
          );
        }
      }

      console.log(
        `[BotManager] Loaded ${this.bots.size} bot(s)`
      );
    } catch (error) {
      console.error(
        "[BotManager] Failed to load bots:",
        error.message
      );
    }
  }

  // ============================================================
  // CREATE INSTANCE
  // ============================================================

  createBotInstance(
    botData,
    save = true
  ) {
    const botType =
      String(
        botData.botType ||
          "SIMPLE"
      ).toUpperCase();

    let bot;

    if (
      botType === "ADVANCED"
    ) {
      bot =
        new AdvancedBot(
          botData
        );
    } else {
      bot =
        new SimpleBot(
          botData
        );
    }

    this.attachStateListener(
      bot
    );

    this.bots.set(
      bot.id,
      bot
    );

    if (save) {
      this.saveBots();
    }

    return bot;
  }

  // ============================================================
  // STATE LISTENER
  // ============================================================

  attachStateListener(
    bot
  ) {
    if (
      !bot ||
      typeof bot.onStateChange !==
        "function"
    ) {
      return;
    }

    bot.onStateChange =
      () => {
        this.saveBots();
      };
  }

  // ============================================================
  // SIMPLE BOT
  // ============================================================

  createBot(config = {}) {
    const botData = {
      ...config,

      botType:
        "SIMPLE",

      id:
        config.id ||
        this.generateId(),

      symbol:
        String(
          config.symbol || ""
        ).toUpperCase(),

      direction:
        String(
          config.direction ||
            "LONG"
        ).toUpperCase(),

      entryModel:
        config.entryModel ||
        "RSI",

      tpPercent:
        Number(
          config.tpPercent ?? 1
        ),

      slPercent:
        Number(
          config.slPercent ?? 0.8
        ),
    };

    return this.createBotInstance(
      botData,
      true
    );
  }

  // ============================================================
  // ADVANCED BOT
  // ============================================================

  createAdvancedBot(
    config = {}
  ) {
    const botData = {
      ...config,

      botType:
        "ADVANCED",

      id:
        config.id ||
        this.generateId(),

      symbol:
        String(
          config.symbol || ""
        ).toUpperCase(),

      direction:
        String(
          config.direction ||
            "LONG"
        ).toUpperCase(),

      entryModel:
        "ORDERBOOK",

      // --------------------------------------------------------
      // POSITION SETTINGS
      // --------------------------------------------------------

      // Default margin per position.
      // Easy to change later.
      marginUSDT:
        Number(
          config.marginUSDT ?? 0.5
        ),

      // Default leverage.
      leverage:
        Number(
          config.leverage ?? 10
        ),

      // --------------------------------------------------------
      // ORDER BOOK
      // --------------------------------------------------------

      longMinImbalance:
        Number(
          config.longMinImbalance ??
            0.005
        ),

      shortMaxImbalance:
        Number(
          config.shortMaxImbalance ??
            -0.005
        ),

      minBidAskRatio:
        Number(
          config.minBidAskRatio ??
            0.9
        ),

      minAskBidRatio:
        Number(
          config.minAskBidRatio ??
            0.9
        ),

      counterTrendRequired:
        Number(
          config.counterTrendRequired ??
            3
        ),

      // --------------------------------------------------------
      // CYCLE
      // --------------------------------------------------------

      cycleMinutes:
        Number(
          config.cycleMinutes ??
            10
        ),

      cycleIntervalMs:
        Number(
          config.cycleIntervalMs ??
            60 * 1000
        ),

      cycleTriggerMinutes:
        Number(
          config.cycleTriggerMinutes ??
            3
        ),

      // --------------------------------------------------------
      // PYRAMIDING
      // --------------------------------------------------------

      maxEntries:
        Math.min(
          3,
          Math.max(
            1,
            Number(
              config.maxEntries ??
                3
            )
          )
        ),

      // --------------------------------------------------------
      // TP / SL
      // --------------------------------------------------------

      tpPercent:
        Number(
          config.tpPercent ??
            1
        ),

      slPercent:
        Number(
          config.slPercent ??
            0.8
        ),

      // --------------------------------------------------------
      // PRICE KILL ZONE
      // --------------------------------------------------------

      killZoneEnabled:
        Boolean(
          config.killZoneEnabled ??
            false
        ),

      killZoneLow:
        config.killZoneLow ===
          "" ||
        config.killZoneLow ===
          undefined ||
        config.killZoneLow ===
          null
          ? null
          : Number(
              config.killZoneLow
            ),

      killZoneHigh:
        config.killZoneHigh ===
          "" ||
        config.killZoneHigh ===
          undefined ||
        config.killZoneHigh ===
          null
          ? null
          : Number(
              config.killZoneHigh
            ),

      // --------------------------------------------------------
      // PRICE TRIGGER LINE
      // --------------------------------------------------------

      triggerLineEnabled:
        Boolean(
          config.triggerLineEnabled ??
            false
        ),

      triggerLinePrice:
        config.triggerLinePrice ===
          "" ||
        config.triggerLinePrice ===
          undefined ||
        config.triggerLinePrice ===
          null
          ? null
          : Number(
              config.triggerLinePrice
            ),
    };

    console.log(
      `[BotManager] Advanced Bot Position | margin=${botData.marginUSDT} USDT | leverage=${botData.leverage}x`
    );

    console.log(
      `[BotManager] Advanced Bot Trigger Line | enabled=${botData.triggerLineEnabled} | price=${botData.triggerLinePrice}`
    );

    return this.createBotInstance(
      botData,
      true
    );
  }

  // ============================================================
  // GET BOT
  // ============================================================

  getBot(id) {
    return this.bots.get(
      id
    );
  }

  // ============================================================
  // GET ALL
  // ============================================================

  getAllBots() {
    return Array.from(
      this.bots.values()
    ).map((bot) =>
      this.getBotState(bot)
    );
  }

  // ============================================================
  // GET BOT STATE
  // ============================================================

  getBotState(bot) {
    if (
      bot &&
      typeof bot.getState ===
        "function"
    ) {
      return bot.getState();
    }

    return bot;
  }

  // ============================================================
  // START
  // ============================================================

  startBot(id) {
    const bot =
      this.bots.get(id);

    if (!bot) {
      throw new Error(
        `Bot not found: ${id}`
      );
    }

    if (
      typeof bot.start !==
      "function"
    ) {
      throw new Error(
        `Bot ${id} cannot be started`
      );
    }

    bot.start();

    this.saveBots();

    return bot;
  }

  // ============================================================
  // STOP
  // ============================================================

  stopBot(id) {
    const bot =
      this.bots.get(id);

    if (!bot) {
      throw new Error(
        `Bot not found: ${id}`
      );
    }

    if (
      typeof bot.stop !==
      "function"
    ) {
      throw new Error(
        `Bot ${id} cannot be stopped`
      );
    }

    bot.stop();

    this.saveBots();

    return bot;
  }

  // ============================================================
  // REMOVE
  // ============================================================

  removeBot(id) {
    const bot =
      this.bots.get(id);

    if (!bot) {
      throw new Error(
        `Bot not found: ${id}`
      );
    }

    if (
      typeof bot.stop ===
      "function"
    ) {
      try {
        bot.stop();
      } catch (error) {
        console.error(
          `[BotManager] Error stopping ${id}:`,
          error.message
        );
      }
    }

    this.bots.delete(id);

    this.saveBots();

    console.log(
      `[BotManager] Removed ${id}`
    );

    return true;
  }

  // ============================================================
  // SAVE
  // ============================================================

  saveBots() {
    try {
      const bots =
        Array.from(
          this.bots.values()
        ).map((bot) =>
          this.getPersistentState(
            bot
          )
        );

      storage.saveBots(
        bots
      );
    } catch (error) {
      console.error(
        "[BotManager] Failed to save bots:",
        error.message
      );
    }
  }

  // ============================================================
  // PERSISTENT STATE
  // ============================================================

  getPersistentState(
    bot
  ) {
    const state =
      this.getBotState(bot);

    if (!state) {
      return null;
    }

    const persistent = {
      ...state,
    };

    delete persistent.timer;
    delete persistent.interval;
    delete persistent.scanTimer;

    if (
      persistent.status ===
      "RUNNING"
    ) {
      persistent.status =
        "STOPPED";
    }

    return persistent;
  }

  // ============================================================
  // ID
  // ============================================================

  generateId() {
    const timestamp =
      Date.now().toString(
        36
      );

    const random =
      Math.random()
        .toString(36)
        .slice(2, 7);

    return `bot_${timestamp}_${random}`;
  }
}

module.exports =
  BotManager;
