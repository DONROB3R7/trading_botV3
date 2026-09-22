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
  if (!value) {
    return "-";
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleTimeString(
    "de-DE",
    {
      timeZone: BERLIN_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }
  );
}

function formatBerlinDateTime(value) {
  if (!value) {
    return "-";
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString(
    "de-DE",
    {
      timeZone: BERLIN_TIME_ZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }
  );
}

function normalizeDirection(value) {
  const direction =
    String(value || "")
      .trim()
      .toUpperCase();

  if (direction === "LONG") {
    return "LONG";
  }

  if (direction === "SHORT") {
    return "SHORT";
  }

  return "NEUTRAL";
}

function directionClass(direction) {
  const normalized =
    normalizeDirection(direction);

  if (normalized === "LONG") {
    return "long";
  }

  if (normalized === "SHORT") {
    return "short";
  }

  return "neutral";
}

function getTrendDirection(trend) {
  if (typeof trend === "string") {
    return normalizeDirection(trend);
  }

  return normalizeDirection(
    trend?.direction
  );
}

function getRawTrendDirection(trend) {
  if (typeof trend === "string") {
    return normalizeDirection(trend);
  }

  return normalizeDirection(
    trend?.rawDirection ??
      trend?.direction
  );
}

function percentageForDepth(depth) {
  const direction =
    normalizeDirection(
      depth?.direction
    );

  if (direction === "LONG") {
    return Number(
      depth?.bidPercentage ?? 0
    );
  }

  if (direction === "SHORT") {
    return Number(
      depth?.askPercentage ?? 0
    );
  }

  return 0;
}

function percentageForTrend(trend) {
  const direction =
    getTrendDirection(trend);

  if (direction === "LONG") {
    return Number(
      trend?.bidPercentage ?? 0
    );
  }

  if (direction === "SHORT") {
    return Number(
      trend?.askPercentage ?? 0
    );
  }

  return 0;
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

  let closest =
    candles[0].time;

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
      distance <
      closestDistance
    ) {
      closest =
        candles[i].time;

      closestDistance =
        distance;
    }
  }

  return closest;
}

// ============================================================
// CHART
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

  // Kill Zone lines
  const priceLinesRef =
    useRef([]);

  // Trigger Line
  const triggerLineRef =
    useRef(null);

  const visibleRangeRef =
    useRef(null);

  const initialChartReadyRef =
    useRef(false);

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

  const botCycle =
    botState.cycle || {};

  const lastAnalysis =
    botState.lastAnalysis ||
    botState.analysis ||
    null;

  const orderBookConfig =
    botState.orderBookConfig ||
    {};

  const decisionHistory =
    Array.isArray(
      botCycle.decisionHistory
    )
      ? botCycle.decisionHistory
      : [];

  const completedCycleHistory =
    Array.isArray(
      botState.completedCycleHistory
    )
      ? botState.completedCycleHistory
      : [];

  const killZone =
    botState.killZone || {};

  const triggerLine =
    botState.triggerLine || {};

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
  // INITIAL BOTS + REFRESH
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
  // SYMBOL
  // ============================================================

  const symbol =
    String(
      selectedBot?.symbol || ""
    ).toUpperCase();

  // ============================================================
  // LOAD MARKET DATA
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

          const rawCandles =
            extractKlines(
              klineResponse
            );

          const normalized =
            rawCandles
              .map(normalizeKline)
              .filter(Boolean)
              .sort(
                (a, b) =>
                  a.time - b.time
              );

          setCandles(normalized);

          const bid =
            Number(
              tickerResponse?.bidPrice ??
                tickerResponse?.bid ??
                tickerResponse?.bestBid
            );

          const ask =
            Number(
              tickerResponse?.askPrice ??
                tickerResponse?.ask ??
                tickerResponse?.bestAsk
            );

          const last =
            Number(
              tickerResponse?.lastPrice ??
                tickerResponse?.last ??
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

  // ============================================================
  // MARKET DATA REFRESH
  // ============================================================

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
            chartContainerRef
              .current.clientWidth,

          height: 600,

          layout: {
            textColor:
              "#d1d5db",

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
          upColor:
            "#22c55e",

          downColor:
            "#ef4444",

          borderVisible:
            false,

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

    initialChartReadyRef.current =
      true;

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
                .current.clientWidth,
          });
        }
      );

    resizeObserver.observe(
      chartContainerRef.current
    );

    return () => {
      resizeObserver.disconnect();

      // Remove Kill Zone lines.
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

      // Remove Trigger Line.
      if (triggerLineRef.current) {
        try {
          candleSeries.removePriceLine(
            triggerLineRef.current
          );
        } catch {
          // Ignore stale trigger line.
        }
      }

      triggerLineRef.current =
        null;

      markersRef.current = null;

      candleSeriesRef.current =
        null;

      chartRef.current = null;

      initialChartReadyRef.current =
        false;

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

    const rangeToRestore =
      visibleRangeRef.current;

    if (rangeToRestore) {
      requestAnimationFrame(() => {
        try {
          chart
            .timeScale()
            .setVisibleLogicalRange(
              rangeToRestore
            );
        } catch {
          // Ignore chart teardown errors.
        }
      });
    } else {
      chart
        .timeScale()
        .fitContent();
    }
  }, [candles]);

  // ============================================================
  // KILL ZONE PRICE LINES
  // ============================================================

  useEffect(() => {
    const series =
      candleSeriesRef.current;

    if (!series) {
      return;
    }

    // Remove old Kill Zone lines.
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

    if (!killZone.enabled) {
      return;
    }

    const low =
      Number(killZone.low);

    const high =
      Number(killZone.high);

    const hasLow =
      Number.isFinite(low);

    const hasHigh =
      Number.isFinite(high);

    if (!hasLow && !hasHigh) {
      return;
    }

    // ----------------------------------------------------------
    // ONE-SIDED KILL LEVEL
    // ----------------------------------------------------------

    if (
      hasLow &&
      !hasHigh
    ) {
      const line =
        series.createPriceLine({
          price: low,

          color: "#f59e0b",

          lineWidth: 2,

          lineStyle:
            LineStyle.Dashed,

          axisLabelVisible:
            true,

          title:
            "KILL LEVEL",
        });

      priceLinesRef.current.push(
        line
      );
    }

    if (
      hasHigh &&
      !hasLow
    ) {
      const line =
        series.createPriceLine({
          price: high,

          color: "#f59e0b",

          lineWidth: 2,

          lineStyle:
            LineStyle.Dashed,

          axisLabelVisible:
            true,

          title:
            "KILL LEVEL",
        });

      priceLinesRef.current.push(
        line
      );
    }

    // ----------------------------------------------------------
    // TWO-SIDED KILL ZONE
    // ----------------------------------------------------------

    if (
      hasLow &&
      hasHigh
    ) {
      const lower =
        Math.min(
          low,
          high
        );

      const upper =
        Math.max(
          low,
          high
        );

      const lowerLine =
        series.createPriceLine({
          price: lower,

          color: "#f59e0b",

          lineWidth: 2,

          lineStyle:
            LineStyle.Dashed,

          axisLabelVisible:
            true,

          title:
            "KILL LOW",
        });

      const upperLine =
        series.createPriceLine({
          price: upper,

          color: "#f59e0b",

          lineWidth: 2,

          lineStyle:
            LineStyle.Dashed,

          axisLabelVisible:
            true,

          title:
            "KILL HIGH",
        });

      priceLinesRef.current.push(
        lowerLine,
        upperLine
      );
    }
  }, [
    selectedBot?.id,
    killZone.enabled,
    killZone.low,
    killZone.high,
  ]);

  // ============================================================
  // TRIGGER LINE
  //
  // LONG:
  // price comes DOWN to trigger price.
  //
  // SHORT:
  // price comes UP to trigger price.
  //
  // Touching the line:
  // -> bot becomes ARMED
  //
  // It does NOT:
  // -> execute trade
  // -> kill bot
  // -> change order-book logic
  // ============================================================

  useEffect(() => {
    const series =
      candleSeriesRef.current;

    if (!series) {
      return;
    }

    // ----------------------------------------------------------
    // REMOVE OLD TRIGGER LINE
    // ----------------------------------------------------------

    if (triggerLineRef.current) {
      try {
        series.removePriceLine(
          triggerLineRef.current
        );
      } catch {
        // Ignore stale trigger line.
      }
    }

    triggerLineRef.current =
      null;

    // ----------------------------------------------------------
    // READ CONFIG
    // ----------------------------------------------------------

    const enabled =
      Boolean(
        botState?.triggerLine
          ?.enabled
      );

    const price =
      Number(
        botState?.triggerLine
          ?.price
      );

    if (
      !enabled ||
      !Number.isFinite(price)
    ) {
      return;
    }

    // ----------------------------------------------------------
    // TITLE
    // ----------------------------------------------------------

    const direction =
      normalizeDirection(
        botState?.direction
      );

    let title =
      "TRIGGER LINE";

    if (direction === "LONG") {
      title =
        "TRIGGER LONG";
    }

    if (direction === "SHORT") {
      title =
        "TRIGGER SHORT";
    }

    // ----------------------------------------------------------
    // CREATE BLUE TRIGGER LINE
    // ----------------------------------------------------------

    triggerLineRef.current =
      series.createPriceLine({
        price,

        color: "#2563eb",

        lineWidth: 3,

        lineStyle:
          LineStyle.Dashed,

        axisLabelVisible:
          true,

        title,
      });
  }, [
    selectedBot?.id,
    botState?.triggerLine?.enabled,
    botState?.triggerLine?.price,
    botState?.direction,
  ]);

  // ============================================================
  // COMPLETED CYCLE MARKERS
  //
  // LONG  -> LONG marker
  // SHORT -> SHORT marker
  // NEUTRAL -> NOTHING
  // ============================================================

  useEffect(() => {
    const markers =
      markersRef.current;

    if (!markers) {
      return;
    }

    if (!candles.length) {
      markers.setMarkers([]);
      return;
    }

    const completedMarkers =
      completedCycleHistory
        .map((cycle) => {
          const decision =
            normalizeDirection(
              cycle?.decision
            );

          if (
            decision !== "LONG" &&
            decision !== "SHORT"
          ) {
            return null;
          }

          const timestamp =
            new Date(
              cycle?.time
            ).getTime();

          if (
            !Number.isFinite(
              timestamp
            )
          ) {
            return null;
          }

          const candleTime =
            findNearestCandleTime(
              candles,
              timestamp
            );

          if (!candleTime) {
            return null;
          }

          if (decision === "LONG") {
            return {
              time: candleTime,

              position:
                "belowBar",

              shape:
                "arrowUp",

              color:
                "#22c55e",

              text:
                "LONG",

              size: 2,

              id:
                `cycle-${cycle.cycleNumber}-LONG`,
            };
          }

          return {
            time: candleTime,

            position:
              "aboveBar",

            shape:
              "arrowDown",

            color:
              "#ef4444",

            text:
              "SHORT",

            size: 2,

            id:
              `cycle-${cycle.cycleNumber}-SHORT`,
          };
        })
        .filter(Boolean)
        .sort(
          (a, b) =>
            Number(a.time) -
            Number(b.time)
        );

    markers.setMarkers(
      completedMarkers
    );
  }, [
    selectedBot?.id,
    completedCycleHistory,
    candles,
  ]);

  // ============================================================
  // CURRENT ORDER BOOK
  // ============================================================

  const trend =
    lastAnalysis?.trend ||
    null;

  const raw200Trend =
    getRawTrendDirection(
      trend
    );

  const activeTrend =
    getTrendDirection(
      trend
    );

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
        direction:
          "NEUTRAL",
        bidPercentage: 0,
        askPercentage: 0,
        imbalance: 0,
      };

  const depth15 =
    getDepth(15);

  const depth20 =
    getDepth(20);

  const depth30 =
    getDepth(30);

  const depth60 =
    getDepth(60);

  const botDirection =
    normalizeDirection(
      botState.direction
    );

  const currentDecision =
    normalizeDirection(
      botState.lastDecision
    );

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div>
      <h1>
        Advanced Bot Chart
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
          Advanced Bot
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
              <label>
                Select Bot
              </label>

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
                Refresh Bots
              </button>
            </div>

            {selectedBot && (
              <div
                style={{
                  marginTop: "16px",
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: "10px",
                }}
              >
                <div>
                  <strong>
                    Bot
                  </strong>
                  <br />
                  {selectedBot.id}
                </div>

                <div>
                  <strong>
                    Symbol
                  </strong>
                  <br />
                  {symbol}
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
                    Status
                  </strong>
                  <br />
                  {botState.status ||
                    "-"}
                </div>

                <div>
                  <strong>
                    Active Trend
                  </strong>
                  <br />
                  {activeTrend}
                </div>

                <div>
                  <strong>
                    200 Raw Trend
                  </strong>
                  <br />
                  {raw200Trend}
                </div>

                <div>
                  <strong>
                    Trigger Minutes
                  </strong>
                  <br />
                  {Number(
                    botCycle.triggerMinutes ??
                      0
                  )}
                  /
                  {Number(
                    botState
                      ?.cycleTriggerMinutes ??
                      botState?.config
                        ?.cycleTriggerMinutes ??
                      botCycle
                        .triggerRequired ??
                      0
                  ) || "-"}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ======================================================
          PRICE CHART
          ====================================================== */}

      {selectedBot && (
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
            Price Chart
          </h2>

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
            <div>
              <strong>
                Bot Symbol:
              </strong>{" "}
              {symbol || "-"}
            </div>

            <label>
              Timeframe:
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

          <div
            style={{
              marginTop: "10px",
            }}
          >
            Chart Time:{" "}
            <strong>
              Europe/Berlin
            </strong>
          </div>

          {/* ==================================================
              TRIGGER / KILL STATUS
              ================================================== */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "10px",
              marginTop: "12px",
            }}
          >
            <div
              style={{
                padding: "10px",
                border:
                  "1px solid #374151",
                borderRadius: "6px",
              }}
            >
              <strong>
                Trigger Line
              </strong>
              <br />

              {triggerLine.enabled
                ? "ON"
                : "OFF"}
            </div>

            <div
              style={{
                padding: "10px",
                border:
                  "1px solid #374151",
                borderRadius: "6px",
              }}
            >
              <strong>
                Trigger Price
              </strong>
              <br />

              {Number.isFinite(
                Number(
                  triggerLine.price
                )
              )
                ? triggerLine.price
                : "-"}
            </div>

            <div
              style={{
                padding: "10px",
                border:
                  "1px solid #374151",
                borderRadius: "6px",
              }}
            >
              <strong>
                Trigger Status
              </strong>
              <br />

              {triggerLine.enabled
                ? triggerLine.armed
                  ? "ARMED"
                  : "WAITING"
                : "OFF"}
            </div>
          </div>

          <div
            style={{
              width: "100%",
              height: "600px",
              position:
                "relative",
              marginTop: "16px",
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
      )}

      {/* ======================================================
          CURRENT ORDER BOOK
          ====================================================== */}

      {selectedBot && (
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
            Current Order Book
          </h2>

          <div
            style={{
              marginBottom:
                "16px",
              padding: "12px",
              border:
                "1px solid #374151",
              borderRadius: "6px",
            }}
          >
            <strong>
              ACTIVE TREND
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

            <div>
              {percentageForTrend(
                trend
              ).toFixed(2)}
              %
            </div>

            <div
              style={{
                marginTop: "8px",
              }}
            >
              200 Raw Trend:{" "}
              <strong>
                {raw200Trend}
              </strong>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(4, minmax(0, 1fr))",
              gap: "10px",
            }}
          >
            {[
              depth15,
              depth20,
              depth30,
              depth60,
            ].map((depth) => (
              <div
                key={depth.depth}
                style={{
                  padding: "12px",
                  border:
                    "1px solid #374151",
                  borderRadius:
                    "6px",
                }}
              >
                <strong>
                  {depth.depth} Levels
                </strong>

                <div
                  className={directionClass(
                    depth.direction
                  )}
                  style={{
                    fontWeight:
                      "bold",
                    marginTop:
                      "6px",
                  }}
                >
                  {normalizeDirection(
                    depth.direction
                  )}
                </div>

                <div>
                  {percentageForDepth(
                    depth
                  ).toFixed(2)}
                  %
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: "16px",
            }}
          >
            Counter Trend:{" "}
            {Number(
              lastAnalysis
                ?.counterTrendCount ??
                0
            )}
            /
            {Number(
              lastAnalysis
                ?.counterTrendRequired ??
                orderBookConfig
                  .counterTrendRequired ??
                3
            )}

            <br />

            Current Decision:{" "}
            <strong>
              {currentDecision}
            </strong>

            <br />

            Reason:{" "}
            {lastAnalysis
              ?.reason || "-"}
          </div>
        </div>
      )}

      {/* ======================================================
          CURRENT 10-MINUTE HISTORY
          ====================================================== */}

      {selectedBot && (
        <div
          style={{
            padding: "16px",
            border:
              "1px solid #374151",
            borderRadius: "8px",
            marginBottom: "16px",
            overflowX:
              "auto",
          }}
        >
          <h2>
            10 Minute Decision History
          </h2>

          <div
            style={{
              marginBottom:
                "12px",
            }}
          >
            {decisionHistory.length} /{" "}
            {Number(
              botCycle.total ??
                botState?.cycleMinutes ??
                10
            )}
          </div>

          {decisionHistory.length ===
          0 ? (
            <div>
              No scans recorded yet.
            </div>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse:
                  "collapse",
              }}
            >
              <thead>
                <tr>
                  <th>#</th>
                  <th>Time</th>
                  <th>Coin</th>
                  <th>Trend</th>
                  <th>200 Raw</th>
                  <th>15</th>
                  <th>20</th>
                  <th>30</th>
                  <th>60</th>
                  <th>Counter</th>
                  <th>Decision</th>
                </tr>
              </thead>

              <tbody>
                {decisionHistory.map(
                  (row) => {
                    const rowTrend =
                      getTrendDirection(
                        row.trend
                      );

                    const rowRawTrend =
                      getRawTrendDirection(
                        row.trend
                      );

                    return (
                      <tr
                        key={`${row.number}-${row.time}`}
                      >
                        <td>
                          {row.number}
                        </td>

                        <td>
                          {formatBerlinTime(
                            row.time
                          )}
                        </td>

                        <td>
                          {row.coin ||
                            symbol}
                        </td>

                        <td>
                          <strong>
                            {
                              rowTrend
                            }
                          </strong>

                          <br />

                          {percentageForTrend(
                            row.trend
                          ).toFixed(2)}
                          %
                        </td>

                        <td>
                          <strong>
                            {
                              rowRawTrend
                            }
                          </strong>
                        </td>

                        {[
                          15,
                          20,
                          30,
                          60,
                        ].map(
                          (
                            depthNumber
                          ) => {
                            const depth =
                              Array.isArray(
                                row.depths
                              )
                                ? row.depths.find(
                                    (
                                      item
                                    ) =>
                                      Number(
                                        item.depth
                                      ) ===
                                      depthNumber
                                  )
                                : null;

                            return (
                              <td
                                key={
                                  depthNumber
                                }
                              >
                                <strong>
                                  {normalizeDirection(
                                    depth?.direction
                                  )}
                                </strong>

                                <br />

                                {percentageForDepth(
                                  depth
                                ).toFixed(
                                  2
                                )}
                                %
                              </td>
                            );
                          }
                        )}

                        <td>
                          {Number(
                            row.counterTrendCount ??
                              0
                          )}
                          /
                          {Number(
                            row.counterTrendRequired ??
                              3
                          )}
                        </td>

                        <td>
                          <strong>
                            {normalizeDirection(
                              row.decision
                            )}
                          </strong>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          )}

          <div
            style={{
              marginTop: "16px",
            }}
          >
            Cycle Progress:{" "}
            {Number(
              botCycle.scans ?? 0
            )}
            /
            {Number(
              botCycle.total ??
                botState?.cycleMinutes ??
                10
            )}

            <br />

            Trigger Minutes:{" "}
            {Number(
              botCycle.triggerMinutes ??
                0
            )}
            /
            {Number(
              botState
                ?.cycleTriggerMinutes ??
                botCycle
                  .triggerRequired ??
                0
            ) || "-"}
          </div>
        </div>
      )}

      {/* ======================================================
          COMPLETED CYCLE HISTORY
          ====================================================== */}

      {selectedBot && (
        <div
          style={{
            padding: "16px",
            border:
              "1px solid #374151",
            borderRadius: "8px",
            marginBottom: "16px",
            overflowX:
              "auto",
          }}
        >
          <h2>
            Completed Cycle History
          </h2>

          <div
            style={{
              marginBottom:
                "12px",
            }}
          >
            {
              completedCycleHistory.length
            }{" "}
            cycles
          </div>

          {completedCycleHistory.length ===
          0 ? (
            <div>
              No completed cycles yet.
            </div>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse:
                  "collapse",
              }}
            >
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Coin</th>
                  <th>Active Trend</th>
                  <th>Entry Votes</th>
                  <th>Decision</th>
                  <th>Reason</th>
                </tr>
              </thead>

              <tbody>
                {completedCycleHistory.map(
                  (cycle) => (
                    <tr
                      key={`${cycle.cycleNumber}-${cycle.time}`}
                    >
                      <td>
                        {formatBerlinTime(
                          cycle.time
                        )}
                      </td>

                      <td>
                        {cycle.coin ||
                          symbol}
                      </td>

                      <td>
                        {getTrendDirection(
                          cycle.trend
                        )}
                      </td>

                      <td>
                        {Number(
                          cycle.entryVotes ??
                            0
                        )}
                        /
                        {Number(
                          cycle.totalScans ??
                            10
                        )}
                      </td>

                      <td>
                        <strong>
                          {normalizeDirection(
                            cycle.decision
                          )}
                        </strong>
                      </td>

                      <td>
                        {cycle.reason ||
                          "-"}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ======================================================
          MARKET SUMMARY
          ====================================================== */}

      <div
        style={{
          marginTop: "16px",
          padding: "16px",
          border:
            "1px solid #374151",
          borderRadius: "8px",
        }}
      >
        <h2>
          Market Summary
        </h2>

        <div>
          Symbol:{" "}
          <strong>
            {symbol || "-"}
          </strong>
        </div>

        <div>
          Current Price:{" "}
          <strong>
            {Number.isFinite(
              currentPrice
            )
              ? currentPrice
              : "-"}
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

        <div>
          Bot Status:{" "}
          <strong>
            {botState.status || "-"}
          </strong>
        </div>

        <div>
          Final/current decision:{" "}
          <strong>
            {currentDecision}
          </strong>
        </div>

        {/* ==================================================
            TRIGGER LINE STATUS
            ================================================== */}

        <div
          style={{
            marginTop: "10px",
          }}
        >
          Trigger Line:{" "}
          <strong>
            {triggerLine.enabled
              ? "ON"
              : "OFF"}
          </strong>
        </div>

        {triggerLine.enabled && (
          <>
            <div>
              Trigger Price:{" "}
              <strong>
                {Number.isFinite(
                  Number(
                    triggerLine.price
                  )
                )
                  ? triggerLine.price
                  : "-"}
              </strong>
            </div>

            <div>
              Trigger Status:{" "}
              <strong>
                {triggerLine.armed
                  ? "ARMED"
                  : "WAITING"}
              </strong>
            </div>

            {triggerLine.triggeredAt && (
              <div>
                Triggered At:{" "}
                <strong>
                  {formatBerlinDateTime(
                    triggerLine.triggeredAt
                  )}
                </strong>
              </div>
            )}
          </>
        )}

        {/* ==================================================
            KILL ZONE STATUS
            ================================================== */}

        <div
          style={{
            marginTop: "10px",
          }}
        >
          Kill Zone:{" "}
          <strong>
            {killZone.enabled
              ? "ON"
              : "OFF"}
          </strong>
        </div>

        {killZone.enabled && (
          <>
            <div>
              Kill Low:{" "}
              {Number.isFinite(
                Number(
                  killZone.low
                )
              )
                ? killZone.low
                : "-"}
            </div>

            <div>
              Kill High:{" "}
              {Number.isFinite(
                Number(
                  killZone.high
                )
              )
                ? killZone.high
                : "-"}
            </div>

            {killZone.reason && (
              <div>
                Kill Reason:{" "}
                <strong>
                  {killZone.reason}
                </strong>
              </div>
            )}
          </>
        )}

        {loading && (
          <div>
            Updating market data...
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: "10px",
            }}
          >
            Error: {error}
          </div>
        )}
      </div>
    </div>
  );
}