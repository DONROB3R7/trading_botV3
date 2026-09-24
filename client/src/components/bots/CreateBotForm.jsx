import { useEffect, useState } from "react";

import {
  createBot,
  createAdvancedBot,
  getSymbols,
  getWeexPosition,
} from "../../services/api";

import "./CreateBotForm.css";

function CreateBotForm({ onCreated }) {
  const [botType, setBotType] =
    useState("SIMPLE");

  const [symbols, setSymbols] =
    useState([]);

  const [loadingSymbols, setLoadingSymbols] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  // ============================================================
  // WEEX POSITION TEST
  // ============================================================

  const [positionTestLoading, setPositionTestLoading] =
    useState(false);

  const [positionTest, setPositionTest] =
    useState(null);

  const [positionTestError, setPositionTestError] =
    useState("");

  const [positionTestSide, setPositionTestSide] =
    useState("LONG");

  // ============================================================
  // SIMPLE BOT
  // ============================================================

  const [simple, setSimple] = useState({
    symbol: "",
    direction: "LONG",
    entryModel: "RSI",

    tpPercent: 1,
    slPercent: 0.8,

    rsiPeriod: 14,
    rsiLongEntry: 30,
    rsiShortEntry: 70,
  });

  // ============================================================
  // ADVANCED BOT
  // ============================================================

  const [advanced, setAdvanced] = useState({
    symbol: "",
    direction: "LONG",

    longMinImbalance: 0.005,
    shortMaxImbalance: -0.005,

    minBidAskRatio: 0.9,
    minAskBidRatio: 0.9,

    counterTrendRequired: 3,

    cycleMinutes: 10,
    cycleIntervalMs: 60000,
    cycleTriggerMinutes: 3,

    maxEntries: 3,

    tpPercent: 1,
    slPercent: 0.8,

    killZoneEnabled: false,
    killZoneLow: "",
    killZoneHigh: "",

    triggerLineEnabled: false,
    triggerLinePrice: "",
  });

  // ============================================================
  // LOAD WEEX SYMBOLS
  // ============================================================

  useEffect(() => {
    loadSymbols();
  }, []);

  async function loadSymbols() {
    try {
      setLoadingSymbols(true);
      setError("");

      const response =
        await getSymbols();

      const data =
        response?.data ??
        response;

      let list = [];

      if (
        Array.isArray(data)
      ) {
        list = data;
      } else if (
        Array.isArray(data?.data)
      ) {
        list = data.data;
      } else if (
        Array.isArray(data?.symbols)
      ) {
        list = data.symbols;
      }

      const normalized =
        list
          .map((item) => {
            if (
              typeof item ===
              "string"
            ) {
              return item.toUpperCase();
            }

            return String(
              item.symbol ||
                item.instId ||
                item.contractName ||
                ""
            ).toUpperCase();
          })
          .filter(Boolean)
          .filter((symbol) =>
            symbol.endsWith("USDT")
          )
          .sort();

      setSymbols(normalized);

      if (
        normalized.length > 0
      ) {
        setSimple(
          (current) => ({
            ...current,
            symbol:
              current.symbol ||
              normalized[0],
          })
        );

        setAdvanced(
          (current) => ({
            ...current,
            symbol:
              current.symbol ||
              normalized[0],
          })
        );
      }
    } catch (err) {
      console.error(
        "[CreateBotForm] Symbols error:",
        err
      );

      setError(
        err.message ||
          "Failed to load WEEX symbols"
      );
    } finally {
      setLoadingSymbols(false);
    }
  }

  // ============================================================
  // HANDLERS
  // ============================================================

  function updateSimple(
    field,
    value
  ) {
    setSimple(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  }

  function updateAdvanced(
    field,
    value
  ) {
    setAdvanced(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  }

  // ============================================================
  // WEEX POSITION TEST
  // ============================================================

  async function handlePositionTest() {
    try {
      setPositionTestLoading(true);
      setPositionTestError("");
      setPositionTest(null);

      const response =
        await getWeexPosition(
          advanced.symbol,
          positionTestSide
        );

      const result =
        response?.result ??
        response;

      setPositionTest(result);
    } catch (err) {
      console.error(
        "[CreateBotForm] WEEX Position Test error:",
        err
      );

      setPositionTestError(
        err.message ||
          "Failed to read WEEX position"
      );
    } finally {
      setPositionTestLoading(false);
    }
  }

  // ============================================================
  // CREATE BOT
  // ============================================================

  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      // ========================================================
      // SIMPLE
      // ========================================================

      if (
        botType ===
        "SIMPLE"
      ) {
        const bot =
          await createBot({
            ...simple,

            tpPercent:
              Number(
                simple.tpPercent
              ),

            slPercent:
              Number(
                simple.slPercent
              ),

            rsiPeriod:
              Number(
                simple.rsiPeriod
              ),

            rsiLongEntry:
              Number(
                simple.rsiLongEntry
              ),

            rsiShortEntry:
              Number(
                simple.rsiShortEntry
              ),
          });

        onCreated?.(bot);

        return;
      }

      // ========================================================
      // ADVANCED PAYLOAD
      // ========================================================

      const payload = {
        symbol:
          advanced.symbol,

        direction:
          advanced.direction,

        entryModel:
          "ORDERBOOK",

        longMinImbalance:
          Number(
            advanced.longMinImbalance
          ),

        shortMaxImbalance:
          Number(
            advanced.shortMaxImbalance
          ),

        minBidAskRatio:
          Number(
            advanced.minBidAskRatio
          ),

        minAskBidRatio:
          Number(
            advanced.minAskBidRatio
          ),

        counterTrendRequired:
          Number(
            advanced.counterTrendRequired
          ),

        cycleMinutes:
          Number(
            advanced.cycleMinutes
          ),

        cycleIntervalMs:
          Number(
            advanced.cycleIntervalMs
          ),

        cycleTriggerMinutes:
          Number(
            advanced.cycleTriggerMinutes
          ),

        maxEntries:
          Number(
            advanced.maxEntries
          ),

        tpPercent:
          Number(
            advanced.tpPercent
          ),

        slPercent:
          Number(
            advanced.slPercent
          ),

        killZoneEnabled:
          Boolean(
            advanced.killZoneEnabled
          ),

        killZoneLow:
          advanced.killZoneLow ===
          ""
            ? null
            : Number(
                advanced.killZoneLow
              ),

        killZoneHigh:
          advanced.killZoneHigh ===
          ""
            ? null
            : Number(
                advanced.killZoneHigh
              ),

        triggerLineEnabled:
          Boolean(
            advanced.triggerLineEnabled
          ),

        triggerLinePrice:
          advanced.triggerLinePrice ===
          ""
            ? null
            : Number(
                advanced.triggerLinePrice
              ),
      };

      console.log(
        "[CreateBotForm] Advanced payload:",
        payload
      );

      console.log(
        "[CreateBotForm] Trigger Line:",
        {
          enabled:
            payload.triggerLineEnabled,

          price:
            payload.triggerLinePrice,
        }
      );

      const bot =
        await createAdvancedBot(
          payload
        );

      onCreated?.(bot);

      setError("");
    } catch (err) {
      console.error(
        "[CreateBotForm] Create error:",
        err
      );

      setError(
        err.message ||
          "Failed to create bot"
      );
    } finally {
      setSaving(false);
    }
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <form
      className="create-bot-form"
      onSubmit={
        handleSubmit
      }
    >
      {/* ======================================================
          BOT TYPE
      ======================================================= */}

      <div className="form-section form-section-main">
        <div className="form-section-header">
          <div>
            <h3>🤖 Bot Type</h3>

            <p>
              Choose which trading engine this bot will use.
            </p>
          </div>
        </div>

        <div className="bot-type-selector">
          <button
            type="button"
            className={
              botType === "SIMPLE"
                ? "bot-type-button active"
                : "bot-type-button"
            }
            onClick={() =>
              setBotType("SIMPLE")
            }
          >
            ⚡ Simple
          </button>

          <button
            type="button"
            className={
              botType === "ADVANCED"
                ? "bot-type-button active"
                : "bot-type-button"
            }
            onClick={() =>
              setBotType("ADVANCED")
            }
          >
            🧠 Advanced
          </button>
        </div>
      </div>

      {/* ======================================================
          SIMPLE
      ======================================================= */}

      {botType ===
        "SIMPLE" && (
        <div className="form-section">
          <div className="form-section-header">
            <div>
              <h3>⚡ Simple Bot</h3>

              <p>
                Basic RSI/SMA based bot configuration.
              </p>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label>Coin</label>

              <select
                value={
                  simple.symbol
                }
                onChange={(
                  event
                ) =>
                  updateSimple(
                    "symbol",
                    event.target.value
                  )
                }
                disabled={
                  loadingSymbols
                }
              >
                {symbols.map(
                  (symbol) => (
                    <option
                      key={symbol}
                      value={symbol}
                    >
                      {symbol}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="form-field">
              <label>Direction</label>

              <select
                value={
                  simple.direction
                }
                onChange={(
                  event
                ) =>
                  updateSimple(
                    "direction",
                    event.target.value
                  )
                }
              >
                <option value="LONG">
                  LONG
                </option>

                <option value="SHORT">
                  SHORT
                </option>
              </select>
            </div>

            <div className="form-field">
              <label>Entry Model</label>

              <select
                value={
                  simple.entryModel
                }
                onChange={(
                  event
                ) =>
                  updateSimple(
                    "entryModel",
                    event.target.value
                  )
                }
              >
                <option value="RSI">
                  RSI
                </option>

                <option value="SMA">
                  SMA
                </option>
              </select>
            </div>

            <div className="form-field">
              <label>TP %</label>

              <input
                type="number"
                step="0.1"
                value={
                  simple.tpPercent
                }
                onChange={(
                  event
                ) =>
                  updateSimple(
                    "tpPercent",
                    event.target.value
                  )
                }
              />
            </div>

            <div className="form-field">
              <label>SL %</label>

              <input
                type="number"
                step="0.1"
                value={
                  simple.slPercent
                }
                onChange={(
                  event
                ) =>
                  updateSimple(
                    "slPercent",
                    event.target.value
                  )
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          ADVANCED
      ======================================================= */}

      {botType ===
        "ADVANCED" && (
        <>
          {/* BASIC */}

          <div className="form-section">
            <div className="form-section-header">
              <div>
                <h3>🧠 Advanced Bot</h3>

                <p>
                  Configure order flow, cycle, pyramiding,
                  TP/SL and price protection.
                </p>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-field">
                <label>Coin</label>

                <select
                  value={
                    advanced.symbol
                  }
                  onChange={(
                    event
                  ) =>
                    updateAdvanced(
                      "symbol",
                      event.target.value
                    )
                  }
                  disabled={
                    loadingSymbols
                  }
                >
                  {symbols.map(
                    (symbol) => (
                      <option
                        key={symbol}
                        value={symbol}
                      >
                        {symbol}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="form-field">
                <label>Direction</label>

                <select
                  value={
                    advanced.direction
                  }
                  onChange={(
                    event
                  ) =>
                    updateAdvanced(
                      "direction",
                      event.target.value
                    )
                  }
                >
                  <option value="LONG">
                    LONG
                  </option>

                  <option value="SHORT">
                    SHORT
                  </option>
                </select>
              </div>
            </div>
          </div>

          {/* WEEX POSITION TEST */}

          <div className="form-section">
            <div className="form-section-header">
              <div>
                <h4>🔌 WEEX Position Test</h4>

                <p>
                  Directly check the current WEEX position.
                </p>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-field">
                <label>Symbol</label>

                <input
                  value={
                    advanced.symbol
                  }
                  disabled
                  readOnly
                />
              </div>

              <div className="form-field">
                <label>Position Side</label>

                <select
                  value={
                    positionTestSide
                  }
                  onChange={(
                    event
                  ) => {
                    setPositionTestSide(
                      event.target.value
                    );

                    setPositionTest(
                      null
                    );

                    setPositionTestError(
                      ""
                    );
                  }}
                >
                  <option value="LONG">
                    LONG
                  </option>

                  <option value="SHORT">
                    SHORT
                  </option>
                </select>
              </div>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={
                handlePositionTest
              }
              disabled={
                positionTestLoading ||
                loadingSymbols ||
                !advanced.symbol
              }
            >
              {positionTestLoading
                ? "Checking WEEX..."
                : "🔍 Check WEEX Position"}
            </button>

            {positionTestError && (
              <div className="form-error">
                {positionTestError}
              </div>
            )}

            {positionTest && (
              <div className="position-result">
                <strong>
                  WEEX Position Result
                </strong>

                <div className="position-grid">
                  <div>
                    Connected
                    <strong>
                      {positionTest.connected
                        ? "YES"
                        : "NO"}
                    </strong>
                  </div>

                  <div>
                    Authenticated
                    <strong>
                      {positionTest.authenticated
                        ? "YES"
                        : "NO"}
                    </strong>
                  </div>

                  <div>
                    Simulated
                    <strong>
                      {positionTest.simulated
                        ? "YES"
                        : "NO"}
                    </strong>
                  </div>

                  <div>
                    Symbol
                    <strong>
                      {positionTest.symbol ||
                        advanced.symbol}
                    </strong>
                  </div>

                  <div>
                    Side
                    <strong>
                      {positionTest.positionSide ||
                        positionTestSide}
                    </strong>
                  </div>

                  <div>
                    Has Position
                    <strong>
                      {positionTest.hasPosition
                        ? "YES"
                        : "NO"}
                    </strong>
                  </div>

                  <div>
                    Size
                    <strong>
                      {positionTest.size ?? 0}
                    </strong>
                  </div>

                  <div>
                    Open Value
                    <strong>
                      {positionTest.openValue ?? 0}
                    </strong>
                  </div>

                  <div>
                    Average Entry Price
                    <strong>
                      {positionTest.averageEntryPrice ??
                        "—"}
                    </strong>
                  </div>
                </div>

                {positionTest.lastPositionSyncError && (
                  <div className="position-sync-error">
                    Sync Error:{" "}
                    {positionTest.lastPositionSyncError}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ORDER BOOK */}

          <div className="form-section">
            <div className="form-section-header">
              <div>
                <h4>📖 Order Book Entry</h4>

                <p>
                  200-level trend with 15 / 20 / 30 / 60
                  confirmation depths.
                </p>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-field">
                <label>200 Level</label>

                <input
                  value="TREND"
                  disabled
                  readOnly
                />
              </div>

              <div className="form-field">
                <label>Entry Depths</label>

                <input
                  value="15 / 20 / 30 / 60"
                  disabled
                  readOnly
                />
              </div>

              <div className="form-field">
                <label>
                  Counter-Trend Required
                </label>

                <select
                  value={
                    advanced.counterTrendRequired
                  }
                  onChange={(
                    event
                  ) =>
                    updateAdvanced(
                      "counterTrendRequired",
                      event.target.value
                    )
                  }
                >
                  <option value="1">
                    1 / 4
                  </option>

                  <option value="2">
                    2 / 4
                  </option>

                  <option value="3">
                    3 / 4
                  </option>

                  <option value="4">
                    4 / 4
                  </option>
                </select>
              </div>

              <div className="form-field">
                <label>
                  Long Min Imbalance
                </label>

                <input
                  type="number"
                  step="0.001"
                  value={
                    advanced.longMinImbalance
                  }
                  onChange={(
                    event
                  ) =>
                    updateAdvanced(
                      "longMinImbalance",
                      event.target.value
                    )
                  }
                />
              </div>

              <div className="form-field">
                <label>
                  Short Max Imbalance
                </label>

                <input
                  type="number"
                  step="0.001"
                  value={
                    advanced.shortMaxImbalance
                  }
                  onChange={(
                    event
                  ) =>
                    updateAdvanced(
                      "shortMaxImbalance",
                      event.target.value
                    )
                  }
                />
              </div>

              <div className="form-field">
                <label>
                  Minimum Bid / Ask Ratio
                </label>

                <input
                  type="number"
                  step="0.01"
                  value={
                    advanced.minBidAskRatio
                  }
                  onChange={(
                    event
                  ) =>
                    updateAdvanced(
                      "minBidAskRatio",
                      event.target.value
                    )
                  }
                />
              </div>

              <div className="form-field">
                <label>
                  Minimum Ask / Bid Ratio
                </label>

                <input
                  type="number"
                  step="0.01"
                  value={
                    advanced.minAskBidRatio
                  }
                  onChange={(
                    event
                  ) =>
                    updateAdvanced(
                      "minAskBidRatio",
                      event.target.value
                    )
                  }
                />
              </div>
            </div>
          </div>

          {/* CYCLE */}

          <div className="form-section">
            <div className="form-section-header">
              <div>
                <h4>⏱️ 10-Minute Cycle</h4>

                <p>
                  Automatic scanning and trigger configuration.
                </p>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-field">
                <label>Cycle Minutes</label>

                <input
                  type="number"
                  min="1"
                  value={
                    advanced.cycleMinutes
                  }
                  onChange={(
                    event
                  ) =>
                    updateAdvanced(
                      "cycleMinutes",
                      event.target.value
                    )
                  }
                />
              </div>

              <div className="form-field">
                <label>Scan Interval</label>

                <input
                  value="1 minute"
                  disabled
                  readOnly
                />
              </div>

              <div className="form-field">
                <label>
                  Trigger Minutes Required
                </label>

                <input
                  type="number"
                  min="1"
                  value={
                    advanced.cycleTriggerMinutes
                  }
                  onChange={(
                    event
                  ) =>
                    updateAdvanced(
                      "cycleTriggerMinutes",
                      event.target.value
                    )
                  }
                />
              </div>
            </div>
          </div>

          {/* PYRAMIDING */}

          <div className="form-section">
            <div className="form-section-header">
              <div>
                <h4>📈 Pyramiding</h4>

                <p>
                  Maximum number of entries for one
                  position cycle.
                </p>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-field">
                <label>
                  Maximum Entries
                </label>

                <select
                  value={
                    advanced.maxEntries
                  }
                  onChange={(
                    event
                  ) =>
                    updateAdvanced(
                      "maxEntries",
                      event.target.value
                    )
                  }
                >
                  <option value="1">
                    1
                  </option>

                  <option value="2">
                    2
                  </option>

                  <option value="3">
                    3
                  </option>
                </select>
              </div>
            </div>
          </div>

          {/* TP / SL */}

          <div className="form-section">
            <div className="form-section-header">
              <div>
                <h4>🎯 TP / SL</h4>

                <p>
                  Initial take-profit and stop-loss
                  configuration.
                </p>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-field">
                <label>TP %</label>

                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={
                    advanced.tpPercent
                  }
                  onChange={(
                    event
                  ) =>
                    updateAdvanced(
                      "tpPercent",
                      event.target.value
                    )
                  }
                />
              </div>

              <div className="form-field">
                <label>SL %</label>

                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={
                    advanced.slPercent
                  }
                  onChange={(
                    event
                  ) =>
                    updateAdvanced(
                      "slPercent",
                      event.target.value
                    )
                  }
                />
              </div>
            </div>
          </div>

          {/* PRICE TRIGGER */}

          <div className="form-section form-section-protection">
            <div className="form-section-header">
              <div>
                <h4>🎯 Price Trigger Line</h4>

                <p>
                  Bot waits for price to touch the configured
                  line before becoming armed.
                </p>
              </div>
            </div>

            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={
                  advanced.triggerLineEnabled
                }
                onChange={(
                  event
                ) =>
                  updateAdvanced(
                    "triggerLineEnabled",
                    event.target.checked
                  )
                }
              />

              <span>
                Enable Price Trigger Line
              </span>
            </label>

            {advanced.triggerLineEnabled && (
              <div className="protection-fields">
                <div className="form-field">
                  <label>
                    Trigger Price
                  </label>

                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Enter trigger price"
                    value={
                      advanced.triggerLinePrice
                    }
                    onChange={(
                      event
                    ) =>
                      updateAdvanced(
                        "triggerLinePrice",
                        event.target.value
                      )
                    }
                    required
                  />
                </div>

                <div className="info-box">
                  <div>
                    LONG → price must come DOWN to
                    the trigger line.
                  </div>

                  <div>
                    SHORT → price must come UP to the
                    trigger line.
                  </div>

                  <div>
                    Touching the line → bot becomes ARMED.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* KILL ZONE */}

          <div className="form-section form-section-danger">
            <div className="form-section-header">
              <div>
                <h4>☠️ Price Kill Zone</h4>

                <p>
                  If price enters the configured zone,
                  the bot is killed.
                </p>
              </div>
            </div>

            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={
                  advanced.killZoneEnabled
                }
                onChange={(
                  event
                ) =>
                  updateAdvanced(
                    "killZoneEnabled",
                    event.target.checked
                  )
                }
              />

              <span>
                Enable Price Kill Zone
              </span>
            </label>

            {advanced.killZoneEnabled && (
              <div className="protection-fields">
                <div className="form-grid">
                  <div className="form-field">
                    <label>
                      Kill Zone Low
                    </label>

                    <input
                      type="number"
                      step="any"
                      placeholder="Optional"
                      value={
                        advanced.killZoneLow
                      }
                      onChange={(
                        event
                      ) =>
                        updateAdvanced(
                          "killZoneLow",
                          event.target.value
                        )
                      }
                    />
                  </div>

                  <div className="form-field">
                    <label>
                      Kill Zone High
                    </label>

                    <input
                      type="number"
                      step="any"
                      placeholder="Optional"
                      value={
                        advanced.killZoneHigh
                      }
                      onChange={(
                        event
                      ) =>
                        updateAdvanced(
                          "killZoneHigh",
                          event.target.value
                        )
                      }
                    />
                  </div>
                </div>

                <div className="warning-box">
                  ☠️ Price enters the configured zone →
                  bot is killed.
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ======================================================
          ERROR
      ======================================================= */}

      {error && (
        <div className="form-error">
          {error}
        </div>
      )}

      {/* ======================================================
          CREATE
      ======================================================= */}

      <div className="create-bot-submit">
        <button
          type="submit"
          className="create-button"
          disabled={
            saving ||
            loadingSymbols
          }
        >
          {saving
            ? "Creating..."
            : "🍌 Create Bot"}
        </button>
      </div>
    </form>
  );
}

export default CreateBotForm;