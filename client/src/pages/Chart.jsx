import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  createChart,
  CandlestickSeries,
  createSeriesMarkers,
  LineStyle,
} from "lightweight-charts";

import {
  getKlines,
  getTicker,
  getBots,
} from "../services/api";

import "./Chart.css";

const BERLIN_TIME_ZONE = "Europe/Berlin";
const REFRESH_MS = 5000;



// ============================================================
// HELPERS
// ============================================================

function formatBerlinTime(value) {
  if (!value) return "-";

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleTimeString("de-DE", {
    timeZone: BERLIN_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatBerlinDateTime(value) {
  if (!value) return "-";

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("de-DE", {
    timeZone: BERLIN_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function normalizeDirection(value) {
  const direction = String(value || "")
    .trim()
    .toUpperCase();

  if (direction === "LONG") return "LONG";
  if (direction === "SHORT") return "SHORT";

  return "NEUTRAL";
}

function directionClass(value) {
  const direction =
    normalizeDirection(value);

  if (direction === "LONG") return "long";
  if (direction === "SHORT") return "short";

  return "neutral";
}

function formatNumber(value, decimals = 5) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "-";
  }

  return number.toFixed(decimals);
}

function formatPercent(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "-";
  }

  return `${number.toFixed(2)}%`;
}

function normalizeKline(candle) {
  if (Array.isArray(candle)) {
    const time = Number(candle[0]);
    const open = Number(candle[1]);
    const high = Number(candle[2]);
    const low = Number(candle[3]);
    const close = Number(candle[4]);

    if (
      !Number.isFinite(time) ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    ) {
      return null;
    }

    return {
      time:
        time > 100000000000
          ? Math.floor(time / 1000)
          : Math.floor(time),
      open,
      high,
      low,
      close,
    };
  }

  if (
    candle &&
    typeof candle === "object"
  ) {
    const rawTime =
      candle.time ??
      candle.openTime ??
      candle.timestamp ??
      candle[0];

    const time = Number(rawTime);

    const open = Number(
      candle.open ?? candle[1]
    );

    const high = Number(
      candle.high ?? candle[2]
    );

    const low = Number(
      candle.low ?? candle[3]
    );

    const close = Number(
      candle.close ?? candle[4]
    );

    if (
      !Number.isFinite(time) ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    ) {
      return null;
    }

    return {
      time:
        time > 100000000000
          ? Math.floor(time / 1000)
          : Math.floor(time),
      open,
      high,
      low,
      close,
    };
  }

  return null;
}

function extractKlines(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.klines)) {
    return response.klines;
  }

  if (
    Array.isArray(
      response?.data?.klines
    )
  ) {
    return response.data.klines;
  }

  return [];
}

function extractBots(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.bots)) {
    return response.bots;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  return [];
}

function findNearestCandleTime(
  candles,
  timestampMs
) {
  if (
    !Array.isArray(candles) ||
    candles.length === 0
  ) {
    return null;
  }

  const target =
    Math.floor(timestampMs / 1000);

  let closest = candles[0].time;

  let closestDistance =
    Math.abs(
      candles[0].time - target
    );

  for (
    let i = 1;
    i < candles.length;
    i += 1
  ) {
    const distance =
      Math.abs(
        candles[i].time - target
      );

    if (
      distance < closestDistance
    ) {
      closest = candles[i].time;
      closestDistance = distance;
    }
  }

  return closest;
}

// ============================================================
// GENERIC VALUE HELPERS
// ============================================================

function firstFinite(...values) {
  for (const value of values) {
    const number = Number(value);

    if (Number.isFinite(number)) {
      return number;
    }
  }

  return null;
}

function firstValue(...values) {
  for (const value of values) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      return value;
    }
  }

  return null;
}

// ============================================================
// COMPONENT
// ============================================================

export default function Chart() {
  const chartContainerRef =
    useRef(null);

  const chartRef =
    useRef(null);

  const candleSeriesRef =
    useRef(null);

  const markersRef =
    useRef(null);

  const priceLinesRef =
    useRef([]);

  const visibleRangeRef =
    useRef(null);

  const [bots, setBots] =
    useState([]);

  const [
    selectedBotId,
    setSelectedBotId,
  ] = useState("");

  const [timeframe, setTimeframe] =
    useState("15m");

  const [candles, setCandles] =
    useState([]);

  const [
    currentPrice,
    setCurrentPrice,
  ] = useState(null);

  const [
    lastUpdate,
    setLastUpdate,
  ] = useState(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  // ============================================================
  // ADVANCED BOTS
  // ============================================================

  const advancedBots =
    useMemo(() => {
      return bots.filter((bot) => {
        const type =
          String(
            bot?.botType ??
              bot?.type ??
              ""
          ).toUpperCase();

        return type === "ADVANCED";
      });
    }, [bots]);

  // ============================================================
  // SELECTED BOT
  // ============================================================

  const selectedBot =
    useMemo(() => {
      if (!advancedBots.length) {
        return null;
      }

      return (
        advancedBots.find(
          (bot) =>
            String(bot.id) ===
            String(selectedBotId)
        ) ||
        advancedBots[0]
      );
    }, [
      advancedBots,
      selectedBotId,
    ]);

  const botState =
    selectedBot || {};

  const symbol =
    String(
      selectedBot?.symbol || ""
    ).toUpperCase();

  // ============================================================
  // LOAD BOTS
  // ============================================================

  const loadBots =
    useCallback(
      async () => {
        try {
          const response =
            await getBots();

          const allBots =
            extractBots(response);

          setBots(allBots);

          const advanced =
            allBots.filter(
              (bot) =>
                String(
                  bot?.botType ??
                    bot?.type ??
                    ""
                ).toUpperCase() ===
                "ADVANCED"
            );

          if (advanced.length > 0) {
            setSelectedBotId(
              (current) => {
                const stillExists =
                  advanced.some(
                    (bot) =>
                      String(
                        bot.id
                      ) ===
                      String(current)
                  );

                if (stillExists) {
                  return current;
                }

                return String(
                  advanced[0].id
                );
              }
            );
          }
        } catch (err) {
          setError(
            err.message ||
              "Failed to load bots"
          );
        }
      },
      []
    );

  useEffect(() => {
    loadBots();

    const interval =
      setInterval(
        loadBots,
        REFRESH_MS
      );

    return () => {
      clearInterval(interval);
    };
  }, [loadBots]);

  // ============================================================
  // MARKET DATA
  // ============================================================

  const loadMarketData =
    useCallback(
      async () => {
        if (!symbol) {
          return;
        }

        try {
          setLoading(true);
          setError("");

          const [
            klineResponse,
            tickerResponse,
          ] =
            await Promise.all([
              getKlines(
                symbol,
                timeframe,
                500
              ),

              getTicker(symbol),
            ]);

          const normalized =
            extractKlines(
              klineResponse
            )
              .map(normalizeKline)
              .filter(Boolean)
              .sort(
                (a, b) =>
                  a.time - b.time
              );

          setCandles(normalized);

          const bid =
            firstFinite(
              tickerResponse?.bidPrice,
              tickerResponse?.bid,
              tickerResponse?.bestBid
            );

          const ask =
            firstFinite(
              tickerResponse?.askPrice,
              tickerResponse?.ask,
              tickerResponse?.bestAsk
            );

          const last =
            firstFinite(
              tickerResponse?.lastPrice,
              tickerResponse?.last,
              tickerResponse?.price
            );

          let price = null;

          if (
            Number.isFinite(bid) &&
            Number.isFinite(ask) &&
            bid > 0 &&
            ask > 0
          ) {
            price =
              (bid + ask) / 2;
          } else if (
            Number.isFinite(last) &&
            last > 0
          ) {
            price = last;
          }

          setCurrentPrice(price);
          setLastUpdate(new Date());
        } catch (err) {
          setError(
            err.message ||
              "Failed to load market data"
          );
        } finally {
          setLoading(false);
        }
      },
      [
        symbol,
        timeframe,
      ]
    );

  useEffect(() => {
    if (!symbol) {
      return;
    }

    loadMarketData();

    const interval =
      setInterval(
        loadMarketData,
        REFRESH_MS
      );

    return () => {
      clearInterval(interval);
    };
  }, [
    symbol,
    timeframe,
    loadMarketData,
  ]);

  // ============================================================
  // ADVANCED BOT STATE
  // ============================================================

  const triggerLine =
    botState.triggerLine || {};

  const position =
    botState.position ||
    botState.currentPosition ||
    botState.livePosition ||
    {};

  const execution =
    botState.execution ||
    botState.executionState ||
    {};

  const risk =
    botState.risk ||
    botState.riskConfig ||
    {};

  const slTp =
    botState.slTp ||
    botState.sltp ||
    botState.stopTakeProfit ||
    {};

  const killBot =
    botState.killBot ||
    botState.killbot ||
    botState.killZone ||
    {};

  const contract =
    botState.contract ||
    botState.symbolInfo ||
    {};

  // ============================================================
  // DIRECTION
  // ============================================================

  const botDirection =
    normalizeDirection(
      firstValue(
        botState.direction,
        position.side,
        execution.side
      )
    );

  // ============================================================
  // TRIGGER
  // ============================================================

  const triggerEnabled =
    Boolean(
      triggerLine.enabled
    );

  const triggerPrice =
    firstFinite(
      triggerLine.price,
      triggerLine.triggerPrice
    );

  const triggerStatus =
    String(
      firstValue(
        triggerLine.status,
        triggerLine.state,
        triggerLine.armed
          ? "ARMED"
          : triggerEnabled
          ? "WAITING"
          : "OFF"
      )
    ).toUpperCase();

  // ============================================================
  // POSITION
  // ============================================================

  const positionExists =
    Boolean(
      position?.exists ??
        position?.open ??
        position?.isOpen ??
        Number(position?.contracts) > 0
    );

  const positionSide =
    normalizeDirection(
      firstValue(
        position?.side,
        position?.direction,
        botState.positionSide,
        botDirection
      )
    );

  const entryPrice =
    firstFinite(
      position?.entryPrice,
      position?.avgEntryPrice,
      position?.averageEntryPrice,
      execution?.entryPrice,
      botState.entryPrice
    );

  const positionContracts =
    firstFinite(
      position?.contracts,
      position?.quantity,
      position?.size,
      execution?.contracts,
      botState.contracts
    );

  const positionNotional =
    firstFinite(
      position?.notional,
      execution?.notional,
      botState.notional
    );

  // ============================================================
  // SL / TP
  // ============================================================

  const slPercent =
    firstFinite(
      slTp?.slPercent,
      slTp?.stopLossPercent,
      risk?.slPercent,
      botState.slPercent,
      botState.config?.slPercent
    );

  const tpPercent =
    firstFinite(
      slTp?.tpPercent,
      slTp?.takeProfitPercent,
      risk?.tpPercent,
      botState.tpPercent,
      botState.config?.tpPercent
    );

  const stopLossPrice =
    firstFinite(
      slTp?.stopLossPrice,
      slTp?.slPrice,
      slTp?.stopPrice,
      position?.stopLossPrice,
      position?.slPrice,
      botState.stopLossPrice,
      botState.slPrice
    );

  const takeProfitPrice =
    firstFinite(
      slTp?.takeProfitPrice,
      slTp?.tpPrice,
      position?.takeProfitPrice,
      position?.tpPrice,
      botState.takeProfitPrice,
      botState.tpPrice
    );

  // ============================================================
  // EXECUTION
  // ============================================================

  const executionStatus =
    String(
      firstValue(
        execution?.status,
        execution?.state,
        botState.executionStatus,
        position?.status,
        positionExists
          ? "POSITION OPEN"
          : triggerEnabled
          ? "WAITING FOR TRIGGER"
          : botState.status
      ) || "-"
    ).toUpperCase();

  const lastOrderId =
    firstValue(
      execution?.orderId,
      execution?.lastOrderId,
      position?.orderId,
      botState.orderId
    );

  // ============================================================
  // CONTRACT
  // ============================================================

  const contractValue =
    firstFinite(
      contract?.contractVal,
      botState.contractVal,
      botState.config?.contractVal
    );

  const leverage =
    firstFinite(
      execution?.leverage,
      position?.leverage,
      botState.leverage,
      botState.config?.leverage
    );

  const configuredMargin =
    firstFinite(
      execution?.margin,
      botState.margin,
      botState.config?.margin
    );

  const estimatedMargin =
    firstFinite(
      execution?.estimatedMargin,
      botState.estimatedMargin
    );

  // ============================================================
  // KILLBOT
  // ============================================================

  const killBotEnabled =
    Boolean(
      killBot?.enabled ??
        botState.killBotEnabled ??
        botState.config?.killBotEnabled
    );

  const killBotActive =
    Boolean(
      killBot?.active ??
        killBot?.triggered ??
        botState.killBotActive
    );

  const killReason =
    firstValue(
      killBot?.reason,
      botState.killBotReason
    );

  // ============================================================
  // ORDER BOOK DIAGNOSTICS
  // ============================================================

  const lastAnalysis =
    botState.lastAnalysis ||
    botState.analysis ||
    null;

  const orderBookConfig =
    botState.orderBookConfig ||
    {};

  const trend =
    lastAnalysis?.trend ||
    null;

  const depthResults =
    Array.isArray(
      lastAnalysis?.depths
    )
      ? lastAnalysis.depths
      : [];

  const getDepth =
    (depth) =>
      depthResults.find(
        (item) =>
          Number(item.depth) ===
          depth
      ) || {
        depth,
        direction: "NEUTRAL",
        bidPercentage: 0,
        askPercentage: 0,
        imbalance: 0,
      };

  const depths = [
    getDepth(15),
    getDepth(20),
    getDepth(30),
    getDepth(60),
  ];

  const activeTrend =
    normalizeDirection(
      typeof trend === "string"
        ? trend
        : trend?.direction
    );

  const counterTrendCount =
    Number(
      lastAnalysis
        ?.counterTrendCount ?? 0
    );

  const counterTrendRequired =
    Number(
      lastAnalysis
        ?.counterTrendRequired ??
        orderBookConfig.counterTrendRequired ??
        3
    );

  // ============================================================
  // CREATE CHART
  // ============================================================

  useEffect(() => {
    if (
      !chartContainerRef.current
    ) {
      return undefined;
    }

    const chart =
      createChart(
        chartContainerRef.current,
        {
          width:
            chartContainerRef.current
              .clientWidth,

          height: 600,

          layout: {
            textColor: "#d1d5db",

            background: {
              type: "solid",
              color: "#2f3136",
            },
          },

          grid: {
            vertLines: {
              color: "#3b3f46",
            },

            horzLines: {
              color: "#3b3f46",
            },
          },

          rightPriceScale: {
            borderColor:
              "#454a52",
          },

          timeScale: {
            borderColor:
              "#454a52",

            timeVisible: true,

            secondsVisible: true,

            tickMarkFormatter:
              (time) => {
                const date =
                  new Date(
                    Number(time) *
                      1000
                  );

                return date.toLocaleTimeString(
                  "de-DE",
                  {
                    timeZone:
                      BERLIN_TIME_ZONE,

                    hour: "2-digit",

                    minute: "2-digit",

                    second: "2-digit",
                  }
                );
              },
          },

          localization: {
            timeFormatter:
              (time) => {
                const date =
                  new Date(
                    Number(time) *
                      1000
                  );

                return date.toLocaleString(
                  "de-DE",
                  {
                    timeZone:
                      BERLIN_TIME_ZONE,

                    hour: "2-digit",

                    minute: "2-digit",

                    second: "2-digit",
                  }
                );
              },
          },
        }
      );

    const candleSeries =
      chart.addSeries(
        CandlestickSeries,
        {
          upColor: "#22c55e",

          downColor: "#ef4444",

          borderVisible: false,

          wickUpColor:
            "#22c55e",

          wickDownColor:
            "#ef4444",
        }
      );

    const markers =
      createSeriesMarkers(
        candleSeries,
        []
      );

    chartRef.current =
      chart;

    candleSeriesRef.current =
      candleSeries;

    markersRef.current =
      markers;

    const resizeObserver =
      new ResizeObserver(
        () => {
          if (
            !chartContainerRef.current
          ) {
            return;
          }

          chart.applyOptions({
            width:
              chartContainerRef
                .current
                .clientWidth,
          });
        }
      );

    resizeObserver.observe(
      chartContainerRef.current
    );

    return () => {
      resizeObserver.disconnect();

      for (
        const line of
        priceLinesRef.current
      ) {
        try {
          candleSeries.removePriceLine(
            line
          );
        } catch {
          // Ignore stale lines.
        }
      }

      priceLinesRef.current = [];

      markersRef.current = null;
      candleSeriesRef.current =
        null;
      chartRef.current = null;

      chart.remove();
    };
  }, [selectedBot?.id]);

  // ============================================================
  // UPDATE CANDLES
  // ============================================================

  useEffect(() => {
    const series =
      candleSeriesRef.current;

    const chart =
      chartRef.current;

    if (
      !series ||
      !chart ||
      !candles.length
    ) {
      return;
    }

    const currentRange =
      chart
        .timeScale()
        .getVisibleLogicalRange();

    if (currentRange) {
      visibleRangeRef.current =
        currentRange;
    }

    series.setData(candles);

    if (
      visibleRangeRef.current
    ) {
      requestAnimationFrame(() => {
        try {
          chart
            .timeScale()
            .setVisibleLogicalRange(
              visibleRangeRef.current
            );
        } catch {
          // Ignore teardown.
        }
      });
    } else {
      chart
        .timeScale()
        .fitContent();
    }
  }, [candles]);

  // ============================================================
  // PRICE LINES
  // ============================================================

  useEffect(() => {
    const series =
      candleSeriesRef.current;

    if (!series) {
      return;
    }

    for (
      const line of
      priceLinesRef.current
    ) {
      try {
        series.removePriceLine(
          line
        );
      } catch {
        // Ignore stale lines.
      }
    }

    priceLinesRef.current = [];

    if (
      triggerEnabled &&
      Number.isFinite(
        triggerPrice
      )
    ) {
      const line =
        series.createPriceLine({
          price: triggerPrice,

          color: "#2563eb",

          lineWidth: 3,

          lineStyle:
            LineStyle.Dashed,

          axisLabelVisible: true,

          title:
            botDirection === "SHORT"
              ? "TRIGGER SHORT"
              : "TRIGGER LONG",
        });

      priceLinesRef.current.push(
        line
      );
    }

    if (
      positionExists &&
      Number.isFinite(
        entryPrice
      )
    ) {
      const line =
        series.createPriceLine({
          price: entryPrice,

          color: "#f59e0b",

          lineWidth: 2,

          lineStyle:
            LineStyle.Solid,

          axisLabelVisible: true,

          title: "ENTRY",
        });

      priceLinesRef.current.push(
        line
      );
    }

    if (
      Number.isFinite(
        stopLossPrice
      )
    ) {
      const line =
        series.createPriceLine({
          price: stopLossPrice,

          color: "#ef4444",

          lineWidth: 2,

          lineStyle:
            LineStyle.Dashed,

          axisLabelVisible: true,

          title: `SL ${
            Number.isFinite(
              slPercent
            )
              ? `${slPercent}%`
              : ""
          }`,
        });

      priceLinesRef.current.push(
        line
      );
    }

    if (
      Number.isFinite(
        takeProfitPrice
      )
    ) {
      const line =
        series.createPriceLine({
          price: takeProfitPrice,

          color: "#22c55e",

          lineWidth: 2,

          lineStyle:
            LineStyle.Dashed,

          axisLabelVisible: true,

          title: `TP ${
            Number.isFinite(
              tpPercent
            )
              ? `${tpPercent}%`
              : ""
          }`,
        });

      priceLinesRef.current.push(
        line
      );
    }
  }, [
    selectedBot?.id,
    triggerEnabled,
    triggerPrice,
    positionExists,
    entryPrice,
    stopLossPrice,
    takeProfitPrice,
    slPercent,
    tpPercent,
    botDirection,
  ]);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="chart-page">
      <h1>
        AdvancedBot Control Chart
      </h1>

      {/* ======================================================
          BOT SELECTOR
          ====================================================== */}

      <div className="chart-panel">
        <div className="chart-panel-header">
          <h2>Bot</h2>

          {advancedBots.length === 0 ? (
            <div className="chart-muted">
              No Advanced Bots found.
            </div>
          ) : (
            <div className="chart-controls">
              <select
                className="chart-select"
                value={
                  selectedBotId ||
                  String(
                    advancedBots[0]
                      ?.id || ""
                  )
                }
                onChange={(event) =>
                  setSelectedBotId(
                    event.target.value
                  )
                }
              >
                {advancedBots.map(
                  (bot) => (
                    <option
                      key={bot.id}
                      value={bot.id}
                    >
                      {bot.symbol} —{" "}
                      {bot.direction} —{" "}
                      {bot.id}
                    </option>
                  )
                )}
              </select>

              <button
                className="chart-button"
                type="button"
                onClick={loadBots}
              >
                Refresh
              </button>
            </div>
          )}
        </div>
      </div>

      {selectedBot && (
        <>
          {/* ====================================================
              LIVE STATUS
              ==================================================== */}

          <div className="chart-grid chart-grid-status">
            <div className="chart-card">
              <div className="chart-card-title">
                SYMBOL
              </div>

              <div className="chart-card-value chart-card-value-large">
                {symbol}
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-card-title">
                BOT STATUS
              </div>

              <div className="chart-card-value">
                {String(
                  botState.status ||
                    executionStatus ||
                    "-"
                ).toUpperCase()}
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-card-title">
                DIRECTION
              </div>

              <div
                className={`chart-card-value ${directionClass(
                  botDirection
                )}`}
              >
                {botDirection}
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-card-title">
                CURRENT PRICE
              </div>

              <div className="chart-card-value">
                {formatNumber(
                  currentPrice
                )}
              </div>
            </div>
          </div>

          {/* ====================================================
              TRADE LIFECYCLE
              ==================================================== */}

          <div className="chart-panel">
            <h2>
              Trade Lifecycle
            </h2>

            <div className="chart-grid chart-grid-lifecycle">
              <div className="chart-card">
                <div className="chart-card-title">
                  1. TRIGGER
                </div>

                <div className="chart-card-value">
                  {triggerEnabled
                    ? triggerStatus
                    : "OFF"}
                </div>

                <div className="chart-muted">
                  Price:{" "}
                  {formatNumber(
                    triggerPrice
                  )}
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-card-title">
                  2. POSITION
                </div>

                <div className="chart-card-value">
                  {positionExists
                    ? "OPEN"
                    : "FLAT"}
                </div>

                {positionExists && (
                  <>
                    <div className="chart-muted">
                      Side:{" "}
                      {positionSide}
                    </div>

                    <div className="chart-muted">
                      Entry:{" "}
                      {formatNumber(
                        entryPrice
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="chart-card">
                <div className="chart-card-title">
                  3. STOP LOSS
                </div>

                <div className="chart-card-value">
                  {formatNumber(
                    stopLossPrice
                  )}
                </div>

                <div className="chart-muted">
                  Distance:{" "}
                  {formatPercent(
                    slPercent
                  )}
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-card-title">
                  4. TAKE PROFIT
                </div>

                <div className="chart-card-value">
                  {formatNumber(
                    takeProfitPrice
                  )}
                </div>

                <div className="chart-muted">
                  Distance:{" "}
                  {formatPercent(
                    tpPercent
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ====================================================
              PRICE CHART
              ==================================================== */}

          <div className="chart-panel">
            <div className="chart-panel-header">
              <h2>
                Price Chart
              </h2>

              <div className="chart-controls">
                <label className="chart-label">
                  Timeframe
                </label>

                <select
                  className="chart-select"
                  value={timeframe}
                  onChange={(event) =>
                    setTimeframe(
                      event.target.value
                    )
                  }
                >
                  <option value="1m">
                    1m
                  </option>

                  <option value="5m">
                    5m
                  </option>

                  <option value="15m">
                    15m
                  </option>

                  <option value="30m">
                    30m
                  </option>

                  <option value="1h">
                    1h
                  </option>
                </select>

                <button
                  className="chart-button"
                  type="button"
                  onClick={
                    loadMarketData
                  }
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="chart-legend">
              <span className="legend-trigger">
                Blue = Trigger
              </span>{" "}
              |{" "}
              <span className="legend-entry">
                Orange = Entry
              </span>{" "}
              |{" "}
              <span className="legend-sl">
                Red = SL
              </span>{" "}
              |{" "}
              <span className="legend-tp">
                Green = TP
              </span>
            </div>

            <div className="chart-wrapper">
              <div
                ref={
                  chartContainerRef
                }
                className="chart-container"
              />
            </div>
          </div>

          {/* ====================================================
              TRIGGER DETAILS
              ==================================================== */}

          <div className="chart-panel">
            <h2>
              Trigger Line
            </h2>

            <div className="chart-grid chart-grid-details">
              <div className="chart-card">
                <div className="chart-card-title">
                  ENABLED
                </div>
                <div className="chart-card-value">
                  {triggerEnabled
                    ? "YES"
                    : "NO"}
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-card-title">
                  DIRECTION
                </div>
                <div className="chart-card-value">
                  {botDirection}
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-card-title">
                  TRIGGER PRICE
                </div>
                <div className="chart-card-value">
                  {formatNumber(
                    triggerPrice
                  )}
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-card-title">
                  STATUS
                </div>
                <div className="chart-card-value">
                  {triggerEnabled
                    ? triggerStatus
                    : "OFF"}
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-card-title">
                  TRIGGERED AT
                </div>
                <div className="chart-card-value">
                  {formatBerlinDateTime(
                    triggerLine.triggeredAt
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ====================================================
              POSITION / EXECUTION
              ==================================================== */}

          <div className="chart-panel">
            <h2>
              Position & Execution
            </h2>

            <div className="chart-grid chart-grid-details">
              <div className="chart-card">
                <div className="chart-card-title">
                  POSITION
                </div>
                <div className="chart-card-value">
                  {positionExists
                    ? "OPEN"
                    : "FLAT"}
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-card-title">
                  SIDE
                </div>
                <div className="chart-card-value">
                  {positionSide}
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-card-title">
                  ENTRY
                </div>
                <div className="chart-card-value">
                  {formatNumber(
                    entryPrice
                  )}
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-card-title">
                  CONTRACTS
                </div>
                <div className="chart-card-value">
                  {Number.isFinite(
                    positionContracts
                  )
                    ? positionContracts
                    : "-"}
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-card-title">
                  CONTRACT VALUE
                </div>
                <div className="chart-card-value">
                  {Number.isFinite(
                    contractValue
                  )
                    ? `${contractValue} USDT`
                    : "-"}
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-card-title">
                  NOTIONAL
                </div>
                <div className="chart-card-value">
                  {Number.isFinite(
                    positionNotional
                  )
                    ? `${positionNotional.toFixed(
                        4
                      )} USDT`
                    : "-"}
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-card-title">
                  LEVERAGE
                </div>
                <div className="chart-card-value">
                  {Number.isFinite(
                    leverage
                  )
                    ? `${leverage}x`
                    : "-"}
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-card-title">
                  CONFIGURED MARGIN
                </div>
                <div className="chart-card-value">
                  {Number.isFinite(
                    configuredMargin
                  )
                    ? `${configuredMargin.toFixed(
                        4
                      )} USDT`
                    : "-"}
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-card-title">
                  ESTIMATED MARGIN
                </div>
                <div className="chart-card-value">
                  {Number.isFinite(
                    estimatedMargin
                  )
                    ? `${estimatedMargin.toFixed(
                        4
                      )} USDT`
                    : "-"}
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-card-title">
                  EXECUTION
                </div>
                <div className="chart-card-value">
                  {executionStatus}
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-card-title">
                  ORDER ID
                </div>
                <div className="chart-card-value">
                  {lastOrderId || "-"}
                </div>
              </div>
            </div>
          </div>

          {/* ====================================================
              RISK MANAGEMENT
              ==================================================== */}

          <div className="chart-panel">
            <h2>
              Risk Management
            </h2>

            <div className="chart-grid chart-grid-details">
              <div className="chart-card">
                <div className="chart-card-title">
                  STOP LOSS
                </div>

                <div className="chart-card-value chart-card-value-large">
                  {formatNumber(
                    stopLossPrice
                  )}
                </div>

                <div className="chart-muted">
                  {formatPercent(
                    slPercent
                  )}
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-card-title">
                  TAKE PROFIT
                </div>

                <div className="chart-card-value chart-card-value-large">
                  {formatNumber(
                    takeProfitPrice
                  )}
                </div>

                <div className="chart-muted">
                  {formatPercent(
                    tpPercent
                  )}
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-card-title">
                  ENTRY PRICE
                </div>

                <div className="chart-card-value">
                  {formatNumber(
                    entryPrice
                  )}
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-card-title">
                  CURRENT PRICE
                </div>

                <div className="chart-card-value">
                  {formatNumber(
                    currentPrice
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ====================================================
              KILLBOT
              ==================================================== */}

          <div className="chart-panel">
            <h2>
              Killbot / Safety
            </h2>

            <div className="chart-grid chart-grid-details">
              <div className="chart-card">
                <div className="chart-card-title">
                  KILLBOT
                </div>

                <div className="chart-card-value">
                  {killBotEnabled
                    ? "ENABLED"
                    : "DISABLED"}
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-card-title">
                  KILLBOT STATE
                </div>

                <div className="chart-card-value">
                  {killBotActive
                    ? "ACTIVE"
                    : "INACTIVE"}
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-card-title">
                  REASON
                </div>

                <div className="chart-card-value">
                  {killReason || "-"}
                </div>
              </div>
            </div>
          </div>

          {/* ====================================================
              ORDER BOOK DIAGNOSTICS
              ==================================================== */}

          <div className="chart-panel">
            <h2>
              Order-Flow Diagnostics
            </h2>

            <div className="chart-grid chart-grid-orderflow">
              <div className="chart-card">
                <div className="chart-card-title">
                  200 TREND
                </div>

                <div
                  className={`chart-card-value ${directionClass(
                    activeTrend
                  )}`}
                >
                  {activeTrend}
                </div>
              </div>

              {depths.map(
                (depth) => (
                  <div
                    className="chart-card"
                    key={depth.depth}
                  >
                    <div className="chart-card-title">
                      {depth.depth} LEVELS
                    </div>

                    <div
                      className={`chart-card-value ${directionClass(
                        depth.direction
                      )}`}
                    >
                      {normalizeDirection(
                        depth.direction
                      )}
                    </div>

                    <div className="chart-muted">
                      Imbalance:{" "}
                      {formatNumber(
                        depth.imbalance,
                        4
                      )}
                    </div>
                  </div>
                )
              )}

              <div className="chart-card">
                <div className="chart-card-title">
                  COUNTER TREND
                </div>

                <div className="chart-card-value">
                  {counterTrendCount}/
                  {counterTrendRequired}
                </div>
              </div>
            </div>

            <div className="orderflow-reason">
              <strong>
                Reason:
              </strong>{" "}
              {lastAnalysis?.reason ||
                "-"}
            </div>
          </div>

          {/* ====================================================
              MARKET
              ==================================================== */}

          <div className="chart-panel">
            <h2>
              Market
            </h2>

            <div className="chart-grid chart-grid-details">
              <div className="chart-card">
                <div className="chart-card-title">
                  SYMBOL
                </div>

                <div className="chart-card-value">
                  {symbol}
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-card-title">
                  CURRENT PRICE
                </div>

                <div className="chart-card-value">
                  {formatNumber(
                    currentPrice
                  )}
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-card-title">
                  LAST UPDATE
                </div>

                <div className="chart-card-value">
                  {formatBerlinDateTime(
                    lastUpdate
                  )}
                </div>
              </div>
            </div>

            {loading && (
              <div className="chart-loading">
                Updating market data...
              </div>
            )}

            {error && (
              <div className="chart-error">
                Error: {error}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

