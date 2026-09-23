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
//
// AdvancedBot has changed during development. These helpers
// intentionally support several possible state names so the
// chart does not break while the backend evolves.
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

  // ============================================================
  // BOT REFRESH
  // ============================================================

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
              color: "#111827",
            },
          },

          grid: {
            vertLines: {
              color: "#1f2937",
            },

            horzLines: {
              color: "#1f2937",
            },
          },

          rightPriceScale: {
            borderColor:
              "#374151",
          },

          timeScale: {
            borderColor:
              "#374151",

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
  //
  // Trigger
  // Entry
  // Stop Loss
  // Take Profit
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

    // ----------------------------------------------------------
    // TRIGGER
    // ----------------------------------------------------------

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

    // ----------------------------------------------------------
    // ENTRY
    // ----------------------------------------------------------

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

    // ----------------------------------------------------------
    // STOP LOSS
    // ----------------------------------------------------------

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

    // ----------------------------------------------------------
    // TAKE PROFIT
    // ----------------------------------------------------------

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
    <div
      style={{
        padding: "16px",
      }}
    >
      <h1>
        AdvancedBot Control Chart
      </h1>

      {/* ======================================================
          BOT SELECTOR
          ====================================================== */}

      <div
        style={{
          padding: "16px",
          border:
            "1px solid #374151",
          borderRadius: "8px",
          marginBottom: "16px",
        }}
      >
        <h2>
          Bot
        </h2>

        {advancedBots.length === 0 ? (
          <div>
            No Advanced Bots found.
          </div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                gap: "12px",
                alignItems:
                  "center",
                flexWrap:
                  "wrap",
              }}
            >
              <select
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
                type="button"
                onClick={loadBots}
              >
                Refresh
              </button>
            </div>
          </>
        )}
      </div>

      {selectedBot && (
        <>
          {/* ====================================================
              LIVE STATUS
              ==================================================== */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "10px",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                padding: "14px",
                border:
                  "1px solid #374151",
                borderRadius: "8px",
              }}
            >
              <strong>
                SYMBOL
              </strong>

              <div
                style={{
                  fontSize: "20px",
                  fontWeight:
                    "bold",
                  marginTop: "6px",
                }}
              >
                {symbol}
              </div>
            </div>

            <div
              style={{
                padding: "14px",
                border:
                  "1px solid #374151",
                borderRadius: "8px",
              }}
            >
              <strong>
                BOT STATUS
              </strong>

              <div
                style={{
                  marginTop: "6px",
                  fontWeight:
                    "bold",
                }}
              >
                {String(
                  botState.status ||
                    executionStatus ||
                    "-"
                ).toUpperCase()}
              </div>
            </div>

            <div
              style={{
                padding: "14px",
                border:
                  "1px solid #374151",
                borderRadius: "8px",
              }}
            >
              <strong>
                DIRECTION
              </strong>

              <div
                className={directionClass(
                  botDirection
                )}
                style={{
                  marginTop: "6px",
                  fontWeight:
                    "bold",
                }}
              >
                {botDirection}
              </div>
            </div>

            <div
              style={{
                padding: "14px",
                border:
                  "1px solid #374151",
                borderRadius: "8px",
              }}
            >
              <strong>
                CURRENT PRICE
              </strong>

              <div
                style={{
                  marginTop: "6px",
                  fontWeight:
                    "bold",
                }}
              >
                {formatNumber(
                  currentPrice
                )}
              </div>
            </div>
          </div>

          {/* ====================================================
              TRADE LIFECYCLE
              ==================================================== */}

          <div
            style={{
              padding: "16px",
              border:
                "1px solid #374151",
              borderRadius: "8px",
              marginBottom: "16px",
            }}
          >
            <h2>
              Trade Lifecycle
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "10px",
              }}
            >
              <div
                style={{
                  padding: "12px",
                  border:
                    "1px solid #374151",
                  borderRadius: "6px",
                }}
              >
                <strong>
                  1. TRIGGER
                </strong>

                <div
                  style={{
                    marginTop: "6px",
                  }}
                >
                  {triggerEnabled
                    ? triggerStatus
                    : "OFF"}
                </div>

                <div>
                  Price:{" "}
                  {formatNumber(
                    triggerPrice
                  )}
                </div>
              </div>

              <div
                style={{
                  padding: "12px",
                  border:
                    "1px solid #374151",
                  borderRadius: "6px",
                }}
              >
                <strong>
                  2. POSITION
                </strong>

                <div
                  style={{
                    marginTop: "6px",
                  }}
                >
                  {positionExists
                    ? "OPEN"
                    : "FLAT"}
                </div>

                {positionExists && (
                  <>
                    <div>
                      Side:{" "}
                      {positionSide}
                    </div>

                    <div>
                      Entry:{" "}
                      {formatNumber(
                        entryPrice
                      )}
                    </div>
                  </>
                )}
              </div>

              <div
                style={{
                  padding: "12px",
                  border:
                    "1px solid #374151",
                  borderRadius: "6px",
                }}
              >
                <strong>
                  3. STOP LOSS
                </strong>

                <div
                  style={{
                    marginTop: "6px",
                  }}
                >
                  {formatNumber(
                    stopLossPrice
                  )}
                </div>

                <div>
                  Distance:{" "}
                  {formatPercent(
                    slPercent
                  )}
                </div>
              </div>

              <div
                style={{
                  padding: "12px",
                  border:
                    "1px solid #374151",
                  borderRadius: "6px",
                }}
              >
                <strong>
                  4. TAKE PROFIT
                </strong>

                <div
                  style={{
                    marginTop: "6px",
                  }}
                >
                  {formatNumber(
                    takeProfitPrice
                  )}
                </div>

                <div>
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

          <div
            style={{
              padding: "16px",
              border:
                "1px solid #374151",
              borderRadius: "8px",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                flexWrap:
                  "wrap",
                gap: "12px",
              }}
            >
              <h2>
                Price Chart
              </h2>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems:
                    "center",
                }}
              >
                <label>
                  Timeframe
                </label>

                <select
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
                  type="button"
                  onClick={
                    loadMarketData
                  }
                >
                  Refresh
                </button>
              </div>
            </div>

            <div
              style={{
                marginTop: "8px",
                fontSize: "13px",
                opacity: 0.8,
              }}
            >
              Blue = Trigger | Orange =
              Entry | Red = SL | Green =
              TP
            </div>

            <div
              style={{
                width: "100%",
                height: "600px",
                marginTop: "12px",
              }}
            >
              <div
                ref={
                  chartContainerRef
                }
                style={{
                  width: "100%",
                  height: "600px",
                }}
              />
            </div>
          </div>

          {/* ====================================================
              TRIGGER DETAILS
              ==================================================== */}

          <div
            style={{
              padding: "16px",
              border:
                "1px solid #374151",
              borderRadius: "8px",
              marginBottom: "16px",
            }}
          >
            <h2>
              Trigger Line
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "10px",
              }}
            >
              <div>
                <strong>
                  Enabled
                </strong>
                <br />
                {triggerEnabled
                  ? "YES"
                  : "NO"}
              </div>

              <div>
                <strong>
                  Direction
                </strong>
                <br />
                {botDirection}
              </div>

              <div>
                <strong>
                  Trigger Price
                </strong>
                <br />
                {formatNumber(
                  triggerPrice
                )}
              </div>

              <div>
                <strong>
                  Status
                </strong>
                <br />
                {triggerEnabled
                  ? triggerStatus
                  : "OFF"}
              </div>

              <div>
                <strong>
                  Triggered At
                </strong>
                <br />
                {formatBerlinDateTime(
                  triggerLine.triggeredAt
                )}
              </div>
            </div>
          </div>

          {/* ====================================================
              POSITION / EXECUTION
              ==================================================== */}

          <div
            style={{
              padding: "16px",
              border:
                "1px solid #374151",
              borderRadius: "8px",
              marginBottom: "16px",
            }}
          >
            <h2>
              Position & Execution
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "10px",
              }}
            >
              <div>
                <strong>
                  Position
                </strong>
                <br />
                {positionExists
                  ? "OPEN"
                  : "FLAT"}
              </div>

              <div>
                <strong>
                  Side
                </strong>
                <br />
                {positionSide}
              </div>

              <div>
                <strong>
                  Entry
                </strong>
                <br />
                {formatNumber(
                  entryPrice
                )}
              </div>

              <div>
                <strong>
                  Contracts
                </strong>
                <br />
                {Number.isFinite(
                  positionContracts
                )
                  ? positionContracts
                  : "-"}
              </div>

              <div>
                <strong>
                  Contract Value
                </strong>
                <br />
                {Number.isFinite(
                  contractValue
                )
                  ? `${contractValue} USDT`
                  : "-"}
              </div>

              <div>
                <strong>
                  Notional
                </strong>
                <br />
                {Number.isFinite(
                  positionNotional
                )
                  ? `${positionNotional.toFixed(
                      4
                    )} USDT`
                  : "-"}
              </div>

              <div>
                <strong>
                  Leverage
                </strong>
                <br />
                {Number.isFinite(
                  leverage
                )
                  ? `${leverage}x`
                  : "-"}
              </div>

              <div>
                <strong>
                  Configured Margin
                </strong>
                <br />
                {Number.isFinite(
                  configuredMargin
                )
                  ? `${configuredMargin.toFixed(
                      4
                    )} USDT`
                  : "-"}
              </div>

              <div>
                <strong>
                  Estimated Margin
                </strong>
                <br />
                {Number.isFinite(
                  estimatedMargin
                )
                  ? `${estimatedMargin.toFixed(
                      4
                    )} USDT`
                  : "-"}
              </div>

              <div>
                <strong>
                  Execution
                </strong>
                <br />
                {executionStatus}
              </div>

              <div>
                <strong>
                  Order ID
                </strong>
                <br />
                {lastOrderId || "-"}
              </div>
            </div>
          </div>

          {/* ====================================================
              SL / TP
              ==================================================== */}

          <div
            style={{
              padding: "16px",
              border:
                "1px solid #374151",
              borderRadius: "8px",
              marginBottom: "16px",
            }}
          >
            <h2>
              Risk Management
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "10px",
              }}
            >
              <div>
                <strong>
                  Stop Loss
                </strong>

                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "18px",
                    fontWeight:
                      "bold",
                  }}
                >
                  {formatNumber(
                    stopLossPrice
                  )}
                </div>

                <div>
                  {formatPercent(
                    slPercent
                  )}
                </div>
              </div>

              <div>
                <strong>
                  Take Profit
                </strong>

                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "18px",
                    fontWeight:
                      "bold",
                  }}
                >
                  {formatNumber(
                    takeProfitPrice
                  )}
                </div>

                <div>
                  {formatPercent(
                    tpPercent
                  )}
                </div>
              </div>

              <div>
                <strong>
                  Entry Price
                </strong>

                <div
                  style={{
                    marginTop: "6px",
                  }}
                >
                  {formatNumber(
                    entryPrice
                  )}
                </div>
              </div>

              <div>
                <strong>
                  Current Price
                </strong>

                <div
                  style={{
                    marginTop: "6px",
                  }}
                >
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

          <div
            style={{
              padding: "16px",
              border:
                "1px solid #374151",
              borderRadius: "8px",
              marginBottom: "16px",
            }}
          >
            <h2>
              Killbot / Safety
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "10px",
              }}
            >
              <div>
                <strong>
                  Killbot
                </strong>

                <div
                  style={{
                    marginTop: "6px",
                    fontWeight:
                      "bold",
                  }}
                >
                  {killBotEnabled
                    ? "ENABLED"
                    : "DISABLED"}
                </div>
              </div>

              <div>
                <strong>
                  Killbot State
                </strong>

                <div
                  style={{
                    marginTop: "6px",
                    fontWeight:
                      "bold",
                  }}
                >
                  {killBotActive
                    ? "ACTIVE"
                    : "INACTIVE"}
                </div>
              </div>

              <div>
                <strong>
                  Reason
                </strong>

                <div
                  style={{
                    marginTop: "6px",
                  }}
                >
                  {killReason || "-"}
                </div>
              </div>
            </div>
          </div>

          {/* ====================================================
              ORDER BOOK DIAGNOSTICS
              ==================================================== */}

          <div
            style={{
              padding: "16px",
              border:
                "1px solid #374151",
              borderRadius: "8px",
              marginBottom: "16px",
            }}
          >
            <h2>
              Order-Flow Diagnostics
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "10px",
              }}
            >
              <div>
                <strong>
                  200 Trend
                </strong>

                <div
                  className={directionClass(
                    activeTrend
                  )}
                  style={{
                    marginTop: "6px",
                    fontWeight:
                      "bold",
                  }}
                >
                  {activeTrend}
                </div>
              </div>

              {depths.map(
                (depth) => (
                  <div
                    key={depth.depth}
                  >
                    <strong>
                      {depth.depth} Levels
                    </strong>

                    <div
                      className={directionClass(
                        depth.direction
                      )}
                      style={{
                        marginTop:
                          "6px",
                        fontWeight:
                          "bold",
                      }}
                    >
                      {normalizeDirection(
                        depth.direction
                      )}
                    </div>

                    <div>
                      Imbalance:{" "}
                      {formatNumber(
                        depth.imbalance,
                        4
                      )}
                    </div>
                  </div>
                )
              )}

              <div>
                <strong>
                  Counter Trend
                </strong>

                <div
                  style={{
                    marginTop: "6px",
                    fontWeight:
                      "bold",
                  }}
                >
                  {
                    counterTrendCount
                  }
                  /
                  {
                    counterTrendRequired
                  }
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: "12px",
              }}
            >
              Reason:{" "}
              <strong>
                {lastAnalysis?.reason ||
                  "-"}
              </strong>
            </div>
          </div>

          {/* ====================================================
              MARKET
              ==================================================== */}

          <div
            style={{
              padding: "16px",
              border:
                "1px solid #374151",
              borderRadius: "8px",
              marginBottom: "16px",
            }}
          >
            <h2>
              Market
            </h2>

            <div>
              Symbol:{" "}
              <strong>
                {symbol}
              </strong>
            </div>

            <div>
              Current Price:{" "}
              <strong>
                {formatNumber(
                  currentPrice
                )}
              </strong>
            </div>

            <div>
              Last Update:{" "}
              <strong>
                {formatBerlinDateTime(
                  lastUpdate
                )}
              </strong>
            </div>

            {loading && (
              <div
                style={{
                  marginTop: "8px",
                }}
              >
                Updating market data...
              </div>
            )}

            {error && (
              <div
                style={{
                  marginTop: "8px",
                }}
              >
                Error: {error}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
