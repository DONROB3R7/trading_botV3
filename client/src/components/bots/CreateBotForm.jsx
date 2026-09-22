import { useEffect, useState } from "react";

import {
  createBot,
  createAdvancedBot,
  getSymbols,
} from "../../services/api";

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

    // ----------------------------------------------------------
    // ORDER BOOK
    // ----------------------------------------------------------

    longMinImbalance: 0.005,
    shortMaxImbalance: -0.005,

    minBidAskRatio: 0.9,
    minAskBidRatio: 0.9,

    counterTrendRequired: 3,

    // ----------------------------------------------------------
    // CYCLE
    // ----------------------------------------------------------

    cycleMinutes: 10,

    cycleIntervalMs: 60000,

    cycleTriggerMinutes: 3,

    // ----------------------------------------------------------
    // PYRAMIDING
    // ----------------------------------------------------------

    maxEntries: 3,

    // ----------------------------------------------------------
    // TP / SL
    // ----------------------------------------------------------

    tpPercent: 1,
    slPercent: 0.8,

    // ----------------------------------------------------------
    // PRICE KILL ZONE
    // ----------------------------------------------------------

    killZoneEnabled: false,

    killZoneLow: "",

    killZoneHigh: "",

    // ----------------------------------------------------------
    // PRICE TRIGGER LINE
    // ----------------------------------------------------------

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
        list =
          data.symbols;
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
            symbol.endsWith(
              "USDT"
            )
          )
          .sort();

      setSymbols(
        normalized
      );

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
        // ------------------------------------------------------
        // BASIC
        // ------------------------------------------------------

        symbol:
          advanced.symbol,

        direction:
          advanced.direction,

        entryModel:
          "ORDERBOOK",

        // ------------------------------------------------------
        // ORDER BOOK
        // ------------------------------------------------------

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

        // ------------------------------------------------------
        // CYCLE
        // ------------------------------------------------------

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

        // ------------------------------------------------------
        // PYRAMIDING
        // ------------------------------------------------------

        maxEntries:
          Number(
            advanced.maxEntries
          ),

        // ------------------------------------------------------
        // TP / SL
        // ------------------------------------------------------

        tpPercent:
          Number(
            advanced.tpPercent
          ),

        slPercent:
          Number(
            advanced.slPercent
          ),

        // ------------------------------------------------------
        // PRICE KILL ZONE
        // ------------------------------------------------------

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

        // ------------------------------------------------------
        // PRICE TRIGGER LINE
        // ------------------------------------------------------

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

      // ========================================================
      // DEBUG
      // ========================================================
      //
      // IMPORTANT:
      // This proves exactly what is being sent.
      //
      // ========================================================

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

      // ========================================================
      // CREATE
      // ========================================================

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
      onSubmit={
        handleSubmit
      }
      style={{
        display:
          "flex",

        flexDirection:
          "column",

        gap: 16,
      }}
    >
      {/* ======================================================
          BOT TYPE
      ======================================================= */}

      <div>
        <label>
          Bot Type
        </label>

        <select
          value={botType}
          onChange={(event) =>
            setBotType(
              event.target.value
            )
          }
        >
          <option value="SIMPLE">
            SIMPLE
          </option>

          <option value="ADVANCED">
            ADVANCED
          </option>
        </select>
      </div>

      {/* ======================================================
          SIMPLE
      ======================================================= */}

      {botType ===
        "SIMPLE" && (
        <>
          <div>
            <label>
              Coin
            </label>

            <select
              value={
                simple.symbol
              }
              onChange={(
                event
              ) =>
                updateSimple(
                  "symbol",
                  event.target
                    .value
                )
              }
              disabled={
                loadingSymbols
              }
            >
              {symbols.map(
                (symbol) => (
                  <option
                    key={
                      symbol
                    }
                    value={
                      symbol
                    }
                  >
                    {symbol}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label>
              Direction
            </label>

            <select
              value={
                simple.direction
              }
              onChange={(
                event
              ) =>
                updateSimple(
                  "direction",
                  event.target
                    .value
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

          <div>
            <label>
              Entry Model
            </label>

            <select
              value={
                simple.entryModel
              }
              onChange={(
                event
              ) =>
                updateSimple(
                  "entryModel",
                  event.target
                    .value
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

          <div>
            <label>
              TP %
            </label>

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
                  event.target
                    .value
                )
              }
            />
          </div>

          <div>
            <label>
              SL %
            </label>

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
                  event.target
                    .value
                )
              }
            />
          </div>
        </>
      )}

      {/* ======================================================
          ADVANCED
      ======================================================= */}

      {botType ===
        "ADVANCED" && (
        <>
          <h3>
            Advanced Bot
          </h3>

          {/* ------------------------------------------------
              COIN
          ------------------------------------------------- */}

          <div>
            <label>
              Coin
            </label>

            <select
              value={
                advanced.symbol
              }
              onChange={(
                event
              ) =>
                updateAdvanced(
                  "symbol",
                  event.target
                    .value
                )
              }
              disabled={
                loadingSymbols
              }
            >
              {symbols.map(
                (symbol) => (
                  <option
                    key={
                      symbol
                    }
                    value={
                      symbol
                    }
                  >
                    {symbol}
                  </option>
                )
              )}
            </select>
          </div>

          {/* ------------------------------------------------
              DIRECTION
          ------------------------------------------------- */}

          <div>
            <label>
              Direction
            </label>

            <select
              value={
                advanced.direction
              }
              onChange={(
                event
              ) =>
                updateAdvanced(
                  "direction",
                  event.target
                    .value
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

          {/* ------------------------------------------------
              ORDER BOOK
          ------------------------------------------------- */}

          <h4>
            Order Book Entry
          </h4>

          <div>
            <label>
              200 Level
            </label>

            <input
              value="TREND"
              disabled
              readOnly
            />
          </div>

          <div>
            <label>
              Entry Depths
            </label>

            <input
              value="15 / 20 / 30 / 60"
              disabled
              readOnly
            />
          </div>

          <div>
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
                  event.target
                    .value
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

          <div>
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
                  event.target
                    .value
                )
              }
            />
          </div>

          <div>
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
                  event.target
                    .value
                )
              }
            />
          </div>

          <div>
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
                  event.target
                    .value
                )
              }
            />
          </div>

          <div>
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
                  event.target
                    .value
                )
              }
            />
          </div>

          {/* ------------------------------------------------
              CYCLE
          ------------------------------------------------- */}

          <h4>
            10-Minute Cycle
          </h4>

          <div>
            <label>
              Cycle Minutes
            </label>

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
                  event.target
                    .value
                )
              }
            />
          </div>

          <div>
            <label>
              Scan Interval
            </label>

            <input
              value="1 minute"
              disabled
              readOnly
            />
          </div>

          <div>
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
                  event.target
                    .value
                )
              }
            />
          </div>

          {/* ------------------------------------------------
              PYRAMIDING
          ------------------------------------------------- */}

          <h4>
            Pyramiding
          </h4>

          <div>
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
                  event.target
                    .value
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

          {/* ------------------------------------------------
              TP / SL
          ------------------------------------------------- */}

          <h4>
            TP / SL
          </h4>

          <div>
            <label>
              TP %
            </label>

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
                  event.target
                    .value
                )
              }
            />
          </div>

          <div>
            <label>
              SL %
            </label>

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
                  event.target
                    .value
                )
              }
            />
          </div>

          {/* ------------------------------------------------
              PRICE TRIGGER LINE
          ------------------------------------------------- */}

          <h4>
            Price Trigger Line
          </h4>

          <div>
            <label>
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
                    event.target
                      .checked
                  )
                }
              />

              {" "}

              Enable Price Trigger Line
            </label>
          </div>

          {advanced.triggerLineEnabled && (
            <>
              <div>
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
                      event.target
                        .value
                    )
                  }
                  required
                />
              </div>

              <div>
                LONG → price must come
                DOWN to the trigger line.
              </div>

              <div>
                SHORT → price must come
                UP to the trigger line.
              </div>

              <div>
                Touching the line →
                bot becomes ARMED.
              </div>
            </>
          )}

          {/* ------------------------------------------------
              PRICE KILL ZONE
          ------------------------------------------------- */}

          <h4>
            Price Kill Zone
          </h4>

          <div>
            <label>
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
                    event.target
                      .checked
                  )
                }
              />

              {" "}

              Enable Price Kill Zone
            </label>
          </div>

          {advanced.killZoneEnabled && (
            <>
              <div>
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
                      event.target
                        .value
                    )
                  }
                />
              </div>

              <div>
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
                      event.target
                        .value
                    )
                  }
                />
              </div>

              <div>
                Price enters the
                configured zone →
                bot is killed.
              </div>
            </>
          )}
        </>
      )}

      {/* ======================================================
          ERROR
      ======================================================= */}

      {error && (
        <div
          style={{
            padding:
              "10px",

            border:
              "1px solid #ef4444",

            borderRadius:
              "6px",
          }}
        >
          {error}
        </div>
      )}

      {/* ======================================================
          CREATE
      ======================================================= */}

      <button
        type="submit"
        disabled={
          saving ||
          loadingSymbols
        }
      >
        {saving
          ? "Creating..."
          : "Create Bot"}
      </button>
    </form>
  );
}

export default CreateBotForm;
