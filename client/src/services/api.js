const API_BASE_URL = "http://localhost:3001/api";

// ============================================================
// GENERIC REQUEST
// ============================================================

async function request(
  path,
  options = {}
) {
  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      headers: {
        "Content-Type":
          "application/json",
        ...(options.headers || {}),
      },
      ...options,
    }
  );

  const text =
    await response.text();

  let data;

  try {
    data = text
      ? JSON.parse(text)
      : {};
  } catch {
    throw new Error(
      `Invalid server response: ${text}`
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
        `HTTP ${response.status}`
    );
  }

  return data;
}

// ============================================================
// HEALTH
// ============================================================

export async function getHealth() {
  return request(
    "/health"
  );
}

// ============================================================
// MARKET
// ============================================================

export async function getSymbols() {
  return request(
    "/market/symbols"
  );
}

export async function getExchangeInfo(
  symbol = ""
) {
  const query = symbol
    ? `?symbol=${encodeURIComponent(
        symbol
      )}`
    : "";

  return request(
    `/market/exchange-info${query}`
  );
}

export async function getTicker(
  symbol
) {
  return request(
    `/market/ticker/${encodeURIComponent(
      symbol
    )}`
  );
}

export async function getKlines(
  symbol,
  interval = "15m",
  limit = 100
) {
  const params =
    new URLSearchParams({
      interval,
      limit: String(limit),
    });

  return request(
    `/market/klines/${encodeURIComponent(
      symbol
    )}?${params.toString()}`
  );
}

export async function getOrderBook(
  symbol
) {
  return request(
    `/market/orderbook/${encodeURIComponent(
      symbol
    )}`
  );
}

// ============================================================
// BOTS
// ============================================================

export async function getBots() {
  return request(
    "/bots"
  );
}

// ============================================================
// CREATE SIMPLE BOT
// ============================================================

export async function createBot(
  config
) {
  return request(
    "/bots",
    {
      method: "POST",

      body: JSON.stringify({
        symbol:
          config.symbol,

        direction:
          config.direction,

        entryModel:
          config.entryModel,

        tpPercent:
          Number(
            config.tpPercent ?? 1
          ),

        slPercent:
          Number(
            config.slPercent ?? 0.8
          ),

        rsiPeriod:
          Number(
            config.rsiPeriod ?? 14
          ),

        rsiLongEntry:
          Number(
            config.rsiLongEntry ?? 30
          ),

        rsiShortEntry:
          Number(
            config.rsiShortEntry ?? 70
          ),
      }),
    }
  );
}

// ============================================================
// CREATE ADVANCED BOT
// ============================================================

export async function createAdvancedBot(
  config
) {
  const payload = {
    // --------------------------------------------------------
    // BASIC
    // --------------------------------------------------------

    symbol:
      String(
        config.symbol || ""
      ).toUpperCase(),

    direction:
      String(
        config.direction || "LONG"
      ).toUpperCase(),

    entryModel:
      "ORDERBOOK",

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
          60000
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
      Number(
        config.maxEntries ??
          3
      ),

    // --------------------------------------------------------
    // TP / SL
    // --------------------------------------------------------

    tpPercent:
      Number(
        config.tpPercent ?? 1
      ),

    slPercent:
      Number(
        config.slPercent ?? 0.8
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

  // ==========================================================
  // DEBUG
  // ==========================================================

  console.log(
    "[API] createAdvancedBot payload:",
    payload
  );

  console.log(
    "[API] Trigger Line:",
    {
      enabled:
        payload.triggerLineEnabled,

      price:
        payload.triggerLinePrice,
    }
  );

  return request(
    "/advanced-bots",
    {
      method: "POST",

      body:
        JSON.stringify(
          payload
        ),
    }
  );
}

// ============================================================
// START BOT
// ============================================================

export async function startBot(
  botId
) {
  return request(
    `/bots/${encodeURIComponent(
      botId
    )}/start`,
    {
      method: "POST",
    }
  );
}

// ============================================================
// STOP BOT
// ============================================================

export async function stopBot(
  botId
) {
  return request(
    `/bots/${encodeURIComponent(
      botId
    )}/stop`,
    {
      method: "POST",
    }
  );
}

// ============================================================
// MANUAL ADVANCED SCAN
// ============================================================

export async function scanBot(
  botId
) {
  return request(
    `/bots/${encodeURIComponent(
      botId
    )}/scan`,
    {
      method: "POST",
    }
  );
}

// ============================================================
// DELETE BOT
// ============================================================

export async function removeBot(
  botId
) {
  return request(
    `/bots/${encodeURIComponent(
      botId
    )}`,
    {
      method: "DELETE",
    }
  );
}

// ============================================================
// DEFAULT EXPORT
// ============================================================

export default {
  getHealth,
  getSymbols,
  getExchangeInfo,
  getTicker,
  getKlines,
  getOrderBook,

  getBots,

  createBot,
  createAdvancedBot,

  startBot,
  stopBot,
  scanBot,
  removeBot,
};

