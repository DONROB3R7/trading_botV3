import React from "react";
import {
  startBot,
  stopBot,
  removeBot,
  scanBot,
} from "../../services/api";

function BotCard({
  bot,
  onChanged,
}) {
  if (!bot) {
    return null;
  }

  const isAdvanced =
    bot.botType === "ADVANCED";

  const config =
    bot.config || {};

  const analysis =
    bot.analysis || {};

  const orderBookConfig =
    bot.orderBookConfig || {};

  const cycle =
    bot.cycle || {};

  const killZone =
    bot.killZone || {};

  const status =
    String(
      bot.status || "STOPPED"
    ).toUpperCase();

  const direction =
    String(
      bot.direction || ""
    ).toUpperCase();

  const isRunning =
    status === "RUNNING";

  const isKilled =
    status === "KILLED";

  const trend =
    String(
      analysis.trend?.direction ||
        analysis.trend ||
        "WAIT"
    ).toUpperCase();

  const lastDecision =
    String(
      bot.lastDecision ||
        analysis.decision ||
        "WAIT"
    ).toUpperCase();

  const trendDepth =
    orderBookConfig.trendDepth ??
    200;

  const entryDepths =
    orderBookConfig.entryDepths ||
    [15, 20, 30, 60];

  const counterTrendRequired =
    Number(
      orderBookConfig.counterTrendRequired ??
        config.counterTrendRequired ??
        3
    );

  const counterTrendCount =
    Number(
      analysis.counterTrendCount ??
        0
    );

  const cycleMinutes =
    Number(
      cycle.cycleMinutes ??
        config.cycleMinutes ??
        10
    );

  const cycleScanCount =
    Number(
      cycle.scanCount ??
        0
    );

  const cycleTriggerMinutes =
    Number(
      cycle.triggerMinutes ??
        0
    );

  const cycleTriggerRequired =
    Number(
      cycle.triggerRequired ??
        config.cycleTriggerMinutes ??
        3
    );

  const cycleProgress =
    Math.min(
      cycleScanCount,
      cycleMinutes
    );

  const entryCount =
    Number(
      bot.entryCount ??
        cycle.entryCount ??
        0
    );

  const maxEntries =
    Number(
      config.maxEntries ??
        3
    );

  const tpPercent =
    Number(
      config.tpPercent ??
        1
    );

  const slPercent =
    Number(
      config.slPercent ??
        0.8
    );

  const killReason =
    bot.killReason ||
    killZone.reason ||
    "";

  // ============================================================
  // DEPTH RESULT HELPER
  // ============================================================

  function getDepthAnalysis(depth) {
    if (!analysis.depths) {
      return null;
    }

    if (Array.isArray(analysis.depths)) {
      return (
        analysis.depths.find(
          (item) =>
            Number(item.depth) ===
            Number(depth)
        ) || null
      );
    }

    return (
      analysis.depths[String(depth)] ||
      analysis.depths[depth] ||
      null
    );
  }

  function getDirectionClass(value) {
    const normalized =
      String(value || "WAIT")
        .toUpperCase();

    if (normalized === "LONG") {
      return "long";
    }

    if (normalized === "SHORT") {
      return "short";
    }

    return "neutral";
  }

  function formatPercent(value) {
    if (
      value === undefined ||
      value === null ||
      !Number.isFinite(
        Number(value)
      )
    ) {
      return "-";
    }

    return `${(
      Number(value) * 100
    ).toFixed(2)}%`;
  }

  function formatNumber(value) {
    if (
      value === undefined ||
      value === null ||
      !Number.isFinite(
        Number(value)
      )
    ) {
      return "-";
    }

    return Number(value).toFixed(4);
  }

  // ============================================================
  // ACTIONS
  // ============================================================

  async function handleStart() {
    try {
      await startBot(bot.id);
      onChanged?.();
    } catch (error) {
      console.error(
        "[BotCard] Start failed:",
        error
      );
    }
  }

  async function handleStop() {
    try {
      await stopBot(bot.id);
      onChanged?.();
    } catch (error) {
      console.error(
        "[BotCard] Stop failed:",
        error
      );
    }
  }

  async function handleScan() {
    try {
      await scanBot(bot.id);
      onChanged?.();
    } catch (error) {
      console.error(
        "[BotCard] Scan failed:",
        error
      );
    }
  }

  async function handleRemove() {
    const confirmed =
      window.confirm(
        `Delete bot ${
          bot.id
        }?`
      );

    if (!confirmed) {
      return;
    }

    try {
      await removeBot(bot.id);
      onChanged?.();
    } catch (error) {
      console.error(
        "[BotCard] Remove failed:",
        error
      );
    }
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="bot-card">
      {/* ======================================================
          HEADER
      ======================================================= */}

      <div className="bot-card-header">
        <div>
          <h3>
            {bot.symbol}
          </h3>

          <div>
            {isAdvanced
              ? "ADVANCED"
              : "SIMPLE"}
          </div>
        </div>

        <div>
          <strong>
            {status}
          </strong>
        </div>
      </div>

      {/* ======================================================
          BASIC INFO
      ======================================================= */}

      <div className="bot-card-section">
        <div>
          <strong>
            Direction
          </strong>

          <span>
            {direction}
          </span>
        </div>

        <div>
          <strong>
            Entry Model
          </strong>

          <span>
            {config.entryModel ||
              bot.entryModel ||
              (isAdvanced
                ? "ORDERBOOK"
                : "-")}
          </span>
        </div>
      </div>

      {/* ======================================================
          ADVANCED BOT
      ======================================================= */}

      {isAdvanced && (
        <>
          {/* --------------------------------------------------
              ORDER BOOK TREND
          --------------------------------------------------- */}

          <div className="bot-card-section">
            <h4>
              ORDER BOOK TREND
            </h4>

            <div>
              <strong>
                {trendDepth} Levels
              </strong>

              <span
                className={
                  getDirectionClass(
                    trend
                  )
                }
              >
                {trend}
              </span>
            </div>

            <div>
              <strong>
                Bot Direction
              </strong>

              <span
                className={
                  getDirectionClass(
                    direction
                  )
                }
              >
                {direction}
              </span>
            </div>
          </div>

          {/* --------------------------------------------------
              ENTRY DEPTHS
          --------------------------------------------------- */}

          <div className="bot-card-section">
            <h4>
              COUNTER-TREND ENTRY
            </h4>

            <div>
              <strong>
                Required
              </strong>

              <span>
                {counterTrendRequired}
                {" / "}
                {entryDepths.length}
              </span>
            </div>

            <div>
              <strong>
                Current
              </strong>

              <span>
                {counterTrendCount}
                {" / "}
                {entryDepths.length}
              </span>
            </div>

            <div className="depth-grid">
              {entryDepths.map(
                (depth) => {
                  const item =
                    getDepthAnalysis(
                      depth
                    );

                  const depthDirection =
                    String(
                      item?.direction ||
                        "WAIT"
                    ).toUpperCase();

                  const passed =
                    item?.direction &&
                    depthDirection !==
                      "WAIT";

                  return (
                    <div
                      key={depth}
                      className="depth-card"
                    >
                      <strong>
                        {depth}
                      </strong>

                      <span
                        className={
                          getDirectionClass(
                            depthDirection
                          )
                        }
                      >
                        {depthDirection}
                      </span>

                      <small>
                        Imbalance:{" "}
                        {formatNumber(
                          item?.imbalance
                        )}
                      </small>

                      <small>
                        Bid/Ask:{" "}
                        {formatNumber(
                          item?.bidAskRatio
                        )}
                      </small>

                      <small>
                        Ask/Bid:{" "}
                        {formatNumber(
                          item?.askBidRatio
                        )}
                      </small>

                      <small>
                        {passed
                          ? "READING"
                          : "WAIT"}
                      </small>
                    </div>
                  );
                }
              )}
            </div>
          </div>

          {/* --------------------------------------------------
              CYCLE
          --------------------------------------------------- */}

          <div className="bot-card-section">
            <h4>
              10-MINUTE CYCLE
            </h4>

            <div>
              <strong>
                Scan Progress
              </strong>

              <span>
                {cycleProgress}
                {" / "}
                {cycleMinutes}
              </span>
            </div>

            <div>
              <strong>
                Trigger Minutes
              </strong>

              <span>
                {cycleTriggerMinutes}
                {" / "}
                {cycleTriggerRequired}
              </span>
            </div>

            <div>
              <strong>
                Final Decision
              </strong>

              <span
                className={
                  getDirectionClass(
                    lastDecision
                  )
                }
              >
                {lastDecision}
              </span>
            </div>
          </div>

          {/* --------------------------------------------------
              PYRAMIDING
          --------------------------------------------------- */}

          <div className="bot-card-section">
            <h4>
              PYRAMIDING
            </h4>

            <div>
              <strong>
                Entries
              </strong>

              <span>
                {entryCount}
                {" / "}
                {maxEntries}
              </span>
            </div>

            <div>
              <strong>
                Next Entry
              </strong>

              <span>
                {entryCount >=
                maxEntries
                  ? "MAX REACHED"
                  : `ENTRY ${
                      entryCount + 1
                    }`}
              </span>
            </div>
          </div>

          {/* --------------------------------------------------
              TP / SL
          --------------------------------------------------- */}

          <div className="bot-card-section">
            <h4>
              TP / SL
            </h4>

            <div>
              <strong>
                TP
              </strong>

              <span>
                {tpPercent}%
              </span>
            </div>

            <div>
              <strong>
                SL
              </strong>

              <span>
                {slPercent}%
              </span>
            </div>
          </div>

          {/* --------------------------------------------------
              PRICE KILL ZONE
          --------------------------------------------------- */}

          <div className="bot-card-section">
            <h4>
              PRICE KILL ZONE
            </h4>

            <div>
              <strong>
                Status
              </strong>

              <span>
                {killZone.enabled ??
                config.killZoneEnabled
                  ? "ON"
                  : "OFF"}
              </span>
            </div>

            {(killZone.enabled ??
              config.killZoneEnabled) && (
              <>
                <div>
                  <strong>
                    Low
                  </strong>

                  <span>
                    {killZone.low ??
                      config.killZoneLow ??
                      "-"}
                  </span>
                </div>

                <div>
                  <strong>
                    High
                  </strong>

                  <span>
                    {killZone.high ??
                      config.killZoneHigh ??
                      "-"}
                  </span>
                </div>
              </>
            )}

            {isKilled && (
              <div>
                <strong>
                  Kill Reason
                </strong>

                <span>
                  {killReason ||
                    "BOT KILLED"}
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {/* ======================================================
          SIMPLE BOT
      ======================================================= */}

      {!isAdvanced && (
        <div className="bot-card-section">
          <div>
            <strong>
              TP
            </strong>

            <span>
              {config.tpPercent ??
                bot.tpPercent ??
                "-"}
              %
            </span>
          </div>

          <div>
            <strong>
              SL
            </strong>

            <span>
              {config.slPercent ??
                bot.slPercent ??
                "-"}
              %
            </span>
          </div>
        </div>
      )}

      {/* ======================================================
          LAST SCAN
      ======================================================= */}

      <div className="bot-card-section">
        <div>
          <strong>
            Last Scan
          </strong>

          <span>
            {bot.lastScanAt ||
              bot.lastScan ||
              "-"}
          </span>
        </div>
      </div>

      {/* ======================================================
          ACTIONS
      ======================================================= */}

      <div className="bot-card-actions">
        {!isRunning &&
          !isKilled && (
            <button
              type="button"
              onClick={handleStart}
            >
              Start
            </button>
          )}

        {isRunning && (
          <button
            type="button"
            onClick={handleStop}
          >
            Stop
          </button>
        )}

        {isAdvanced && (
          <button
            type="button"
            onClick={handleScan}
          >
            Scan
          </button>
        )}

        <button
          type="button"
          onClick={handleRemove}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default BotCard;