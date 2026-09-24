import React from "react";

import {
  startBot,
  stopBot,
  removeBot,
  scanBot,
} from "../../services/api";

import "./bot-card.css";

function BotCard({
  bot,
  onRefresh,
  longBotCount = 0,
  shortBotCount = 0,
}) {
  if (!bot) return null;

  const config = bot.config || {};

  const status = String(
    bot.status || config.status || "STOPPED"
  ).toUpperCase();

  const type = String(
    bot.type ||
      bot.botType ||
      config.type ||
      "simple"
  ).toLowerCase();

  const symbol =
    bot.symbol ||
    config.symbol ||
    bot.name ||
    "UNKNOWN";

  const direction = String(
    bot.direction ||
      config.direction ||
      bot.side ||
      "NEUTRAL"
  ).toUpperCase();

  const entryModel =
    bot.entryModel ||
    config.entryModel ||
    config.model ||
    "—";

  const orderBookTrend =
    config.orderBookTrend ??
    config.trendDepth ??
    config.orderBookDepth ??
    200;

  const counterTrend =
    config.counterTrendRequired ??
    config.counterTrend ??
    "—";

  const entryDepths =
    config.entryDepths ||
    config.confirmationDepths ||
    [15, 20, 30, 60];

  const cycleMinutes =
    config.cycleMinutes ??
    config.cycle ??
    "—";

  const maxEntries =
    config.maxEntries ??
    config.pyramiding ??
    config.maxPyramiding ??
    1;

  const takeProfit =
    config.tpPercent ??
    config.takeProfit ??
    config.tp ??
    "—";

  const stopLoss =
    config.slPercent ??
    config.stopLoss ??
    config.sl ??
    "—";

  const killZone =
    bot.killZone ||
    config.killZone ||
    {};

  const killZoneEnabled = Boolean(
    killZone.enabled ??
      config.killZoneEnabled ??
      false
  );

  const lastScan =
    bot.lastScan ||
    bot.lastScanTime ||
    config.lastScan ||
    "Never";

  const scanResult =
    bot.scanResult ||
    bot.lastScanResult ||
    config.lastScanResult ||
    null;

  const isAdvanced =
    type === "advanced" ||
    type.includes("advanced");

  const isRunning =
    status === "RUNNING";

  const isKilled =
    status === "KILLED";

  const isLong =
    direction === "LONG";

  const isShort =
    direction === "SHORT";

  // ============================================================
  // CAVEMAN THEME ICONS
  // ============================================================

  const tribeIcon = isAdvanced
    ? "🗿"
    : "🐒";

  const creatureIcon = isAdvanced
    ? "🦇"
    : "🦧";

  const activityIcon = isRunning
    ? "🔥"
    : isKilled
      ? "💀"
      : "🪨";

  const directionIcon = isLong
    ? "↑"
    : isShort
      ? "↓"
      : "•";

  // ============================================================
  // HELPERS
  // ============================================================

  const formatValue = (value) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "—";
    }

    if (typeof value === "boolean") {
      return value ? "ON" : "OFF";
    }

    return String(value);
  };

  const formatPercent = (value) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "—";
    }

    const text = String(value);

    if (text.includes("%")) {
      return text;
    }

    return `${text}%`;
  };

  const formatDepths = () => {
    if (Array.isArray(entryDepths)) {
      return entryDepths.join(" / ");
    }

    return String(entryDepths);
  };

  const getDirectionClass = () => {
    if (isLong) return "long";
    if (isShort) return "short";
    return "neutral";
  };

  // ============================================================
  // ACTIONS
  // ============================================================

  const handleStart = async () => {
    try {
      await startBot(bot.id);

      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error(
        `[BotCard:${symbol}] Start failed`,
        error
      );
    }
  };

  const handleStop = async () => {
    try {
      await stopBot(bot.id);

      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error(
        `[BotCard:${symbol}] Stop failed`,
        error
      );
    }
  };

  const handleScan = async () => {
    try {
      await scanBot(bot.id);

      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error(
        `[BotCard:${symbol}] Scan failed`,
        error
      );
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Remove ${symbol} bot?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await removeBot(bot.id);

      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error(
        `[BotCard:${symbol}] Delete failed`,
        error
      );
    }
  };
  
  // ============================================================
  // STACK INFORMATION
  // ============================================================

  const showLongStack =
    isLong &&
    longBotCount > 2;

  const showShortStack =
    isShort &&
    shortBotCount > 2;

  return (
    <div
      className={`bot-card ${
        isAdvanced
          ? "advanced-card"
          : "simple-card"
      } ${getDirectionClass()}`}
    >
      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="bot-card-header">

        <div className="bot-card-title">

          <div className="bot-card-icon">
            <span>{tribeIcon}</span>
            <small>{creatureIcon}</small>
          </div>

          <div>
            <h3>
              {symbol}
            </h3>

            <div className="bot-card-type">
              {isAdvanced
                ? "🗿 ADVANCED CAVEMAN"
                : "🐒 SIMPLE MONKEY"}
            </div>
          </div>

        </div>

        <div
          className={`bot-status ${status.toLowerCase()}`}
        >
          <span className="bot-status-dot" />

          {activityIcon}

          {status}
        </div>

      </div>

      {/* ======================================================
          TRADING DIRECTION
      ====================================================== */}

      <div className="bot-card-section direction-section">

        <h4>
          🔥 TRADING DIRECTION
        </h4>

        <div className="direction-main">

          <div
            className={`direction-badge ${getDirectionClass()}`}
          >
            <span className="direction-arrow">
              {directionIcon}
            </span>

            <strong>
              {direction}
            </strong>
          </div>

          <div className="direction-creature">
            {isLong
              ? "🦇"
              : isShort
                ? "🦇"
                : "🪨"}
          </div>

        </div>

        <div className="bot-card-row">
          <strong>
            Entry Model
          </strong>

          <span>
            {formatValue(entryModel)}
          </span>
        </div>

      </div>

      {/* ======================================================
          STACK WARNING
      ====================================================== */}

      {showLongStack && (
        <div className="tribe-stack long-stack">

          <div className="tribe-stack-title">
            🦇 LONG TRIBE
          </div>

          <div className="tribe-stack-count">
            ↑ {longBotCount} LONG BOTS
          </div>

          <div className="tribe-stack-warning">
            🔥 MORE LONG EXPOSURE
          </div>

          <div className="tribe-stack-arrow">
            ↓
          </div>

        </div>
      )}

      {showShortStack && (
        <div className="tribe-stack short-stack">

          <div className="tribe-stack-title">
            🦇 SHORT TRIBE
          </div>

          <div className="tribe-stack-count">
            ↓ {shortBotCount} SHORT BOTS
          </div>

          <div className="tribe-stack-warning">
            🔥 MORE SHORT EXPOSURE
          </div>

          <div className="tribe-stack-arrow">
            ↑
          </div>

        </div>
      )}

      {/* ======================================================
          ADVANCED
      ====================================================== */}

      {isAdvanced && (
        <>
          <div className="bot-card-section">

            <h4>
              🗿🔥 ORDER FLOW CAVEMAN
            </h4>

            <div className="bot-card-row">
              <strong>
                🦴 Order Book Trend
              </strong>

              <span>
                {formatValue(orderBookTrend)}
              </span>
            </div>

            <div className="bot-card-row">
              <strong>
                🐗 Counter-Trend
              </strong>

              <span>
                {formatValue(counterTrend)}
              </span>
            </div>

            <div className="bot-card-row">
              <strong>
                🔥 Entry Depths
              </strong>

              <span>
                {formatDepths()}
              </span>
            </div>

          </div>

          {/* ENTRY DEPTH VISUAL */}

          <div className="bot-card-section">

            <h4>
              🦴 ENTRY DEPTHS
            </h4>

            <div className="depth-grid">

              {[15, 20, 30, 60].map(
                (depth) => {

                  const depthData =
                    scanResult?.depths?.[depth] ||
                    scanResult?.depth?.[depth] ||
                    null;

                  const depthDirection =
                    depthData?.direction ||
                    depthData?.signal ||
                    "NEUTRAL";

                  const depthClass =
                    String(
                      depthDirection
                    ).toLowerCase();

                  return (
                    <div
                      className="depth-card"
                      key={depth}
                    >
                      <strong>
                        {depth}
                      </strong>

                      <span
                        className={
                          depthClass === "long"
                            ? "long"
                            : depthClass === "short"
                              ? "short"
                              : "neutral"
                        }
                      >
                        {depthClass ===
                        "long"
                          ? "↑ LONG"
                          : depthClass ===
                            "short"
                            ? "↓ SHORT"
                            : "• NEUTRAL"}
                      </span>

                      <small>
                        {depthData?.reason ||
                          "Waiting for scan"}
                      </small>

                    </div>
                  );
                }
              )}

            </div>

          </div>

          {/* BOT SETTINGS */}

          <div className="bot-card-section">

            <h4>
              🦴 CAVEMAN SETTINGS
            </h4>

            <div className="bot-card-row">
              <strong>
                ⏱️ Cycle
              </strong>

              <span>
                {formatValue(
                  cycleMinutes
                )} min
              </span>
            </div>

            <div className="bot-card-row">
              <strong>
                🪵 Pyramiding
              </strong>

              <span>
                {formatValue(maxEntries)}
              </span>
            </div>

            <div className="bot-card-row">
              <strong>
                🎯 Take Profit
              </strong>

              <span>
                {formatPercent(
                  takeProfit
                )}
              </span>
            </div>

            <div className="bot-card-row">
              <strong>
                🛡️ Stop Loss
              </strong>

              <span>
                {formatPercent(
                  stopLoss
                )}
              </span>
            </div>

            <div className="bot-card-row">
              <strong>
                🔥 Kill Zone
              </strong>

              <span
                className={
                  killZoneEnabled
                    ? "enabled"
                    : "disabled"
                }
              >
                {killZoneEnabled
                  ? "🔥 ON"
                  : "🪨 OFF"}
              </span>
            </div>

          </div>
        </>
      )}

      {/* ======================================================
          SIMPLE
      ====================================================== */}

      {!isAdvanced && (
        <div className="bot-card-section">

          <h4>
            🐒 MONKEY SETTINGS
          </h4>

          <div className="bot-card-row">
            <strong>
              🎯 Take Profit
            </strong>

            <span>
              {formatPercent(
                takeProfit
              )}
            </span>
          </div>

          <div className="bot-card-row">
            <strong>
              🛡️ Stop Loss
            </strong>

            <span>
              {formatPercent(
                stopLoss
              )}
            </span>
          </div>

        </div>
      )}

      {/* ======================================================
          LAST SCAN
      ====================================================== */}

      <div className="bot-card-section last-scan">

        <h4>
          👀 LAST SCAN
        </h4>

        <div className="bot-card-row">
          <strong>
            Time
          </strong>

          <span>
            {formatValue(lastScan)}
          </span>
        </div>

        {scanResult && (
          <div className="bot-card-row">
            <strong>
              Result
            </strong>

            <span>
              {formatValue(
                scanResult.reason ||
                scanResult.status ||
                scanResult.signal
              )}
            </span>
          </div>
        )}

      </div>

      {/* ======================================================
          ACTIONS
      ====================================================== */}

      <div className="bot-card-actions">

        {!isRunning ? (
          <button
            className="bot-btn start-btn"
            onClick={handleStart}
          >
            🔥 START
          </button>
        ) : (
          <button
            className="bot-btn stop-btn"
            onClick={handleStop}
          >
            🪨 STOP
          </button>
        )}

        <button
          className="bot-btn scan-btn"
          onClick={handleScan}
        >
          👀 SCAN
        </button>

        <button
          className="bot-btn delete-btn"
          onClick={handleDelete}
        >
          🦴 DELETE
        </button>

      </div>

    </div>
  );
}

export default BotCard;