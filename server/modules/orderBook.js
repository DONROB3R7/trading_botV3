class OrderBookModule {
  constructor(config = {}) {
    this.trendDepth = 200;

    this.entryDepths = [15, 20, 30, 60];

    this.longMinImbalance = Number(
      config.longMinImbalance ?? 0.005
    );

    this.shortMaxImbalance = Number(
      config.shortMaxImbalance ?? -0.005
    );

    this.minBidAskRatio = Number(
      config.minBidAskRatio ?? 0.90
    );

    this.minAskBidRatio = Number(
      config.minAskBidRatio ?? 0.90
    );

    this.counterTrendRequired = Math.min(
      4,
      Math.max(
        1,
        Number(config.counterTrendRequired ?? 3)
      )
    );

    // NEW:
    // LONG  = force LONG trend
    // SHORT = force SHORT trend
    // BOTH / empty = use 200-level trend
    this.forcedTrend =
      String(
        config.forcedTrend || ""
      )
        .trim()
        .toUpperCase();

    if (
      this.forcedTrend !== "LONG" &&
      this.forcedTrend !== "SHORT"
    ) {
      this.forcedTrend = null;
    }
  }


  // ============================================================
  // NORMALIZE LEVELS
  // ============================================================

  normalizeLevels(levels) {
    if (!Array.isArray(levels)) {
      return [];
    }

    return levels
      .map((level) => {
        if (
          !Array.isArray(level) ||
          level.length < 2
        ) {
          return null;
        }

        const price = Number(level[0]);
        const quantity = Number(level[1]);

        if (
          !Number.isFinite(price) ||
          !Number.isFinite(quantity) ||
          quantity < 0
        ) {
          return null;
        }

        return {
          price,
          quantity,
        };
      })
      .filter(Boolean);
  }


  // ============================================================
  // CALCULATE DEPTH
  // ============================================================

  calculateDepth(
    snapshot,
    depth
  ) {
    const bids =
      this.normalizeLevels(
        snapshot.bids
      );

    const asks =
      this.normalizeLevels(
        snapshot.asks
      );

    const depthBids =
      bids.slice(0, depth);

    const depthAsks =
      asks.slice(0, depth);


    const bidVolume =
      depthBids.reduce(
        (total, level) =>
          total + level.quantity,
        0
      );

    const askVolume =
      depthAsks.reduce(
        (total, level) =>
          total + level.quantity,
        0
      );


    const totalVolume =
      bidVolume + askVolume;


    if (totalVolume <= 0) {
      return {
        depth,
        direction: "WAIT",

        bidVolume: 0,
        askVolume: 0,
        totalVolume: 0,

        imbalance: 0,

        bidAskRatio: 0,
        askBidRatio: 0,

        bidPercentage: 0,
        askPercentage: 0,

        longConfirmed: false,
        shortConfirmed: false,
      };
    }


    const imbalance =
      (bidVolume - askVolume) /
      totalVolume;


    const bidAskRatio =
      askVolume > 0
        ? bidVolume / askVolume
        : Infinity;


    const askBidRatio =
      bidVolume > 0
        ? askVolume / bidVolume
        : Infinity;


    const bidPercentage =
      (bidVolume / totalVolume) * 100;


    const askPercentage =
      (askVolume / totalVolume) * 100;


    let direction =
      "WAIT";


    const longConfirmed =
      imbalance >=
        this.longMinImbalance &&
      bidAskRatio >=
        this.minBidAskRatio;


    const shortConfirmed =
      imbalance <=
        this.shortMaxImbalance &&
      askBidRatio >=
        this.minAskBidRatio;


    if (longConfirmed) {
      direction = "LONG";
    } else if (shortConfirmed) {
      direction = "SHORT";
    }


    return {
      depth,

      direction,

      bidVolume,
      askVolume,
      totalVolume,

      imbalance,

      bidAskRatio,
      askBidRatio,

      bidPercentage,
      askPercentage,

      longConfirmed,
      shortConfirmed,
    };
  }


  // ============================================================
  // ANALYZE
  // ============================================================

  analyze(snapshot) {
    if (!snapshot) {
      throw new Error(
        "Order book analysis requires a snapshot"
      );
    }


    if (
      !Array.isArray(snapshot.bids) ||
      !Array.isArray(snapshot.asks)
    ) {
      throw new Error(
        "Order book snapshot must contain bids and asks"
      );
    }


    // ============================================================
    // 1. CALCULATE RAW 200-LEVEL TREND
    // ============================================================

    const rawTrend =
      this.calculateDepth(
        snapshot,
        this.trendDepth
      );


    // ============================================================
    // 2. DETERMINE ACTIVE TREND
    // ============================================================
    //
    // LONG  → forced LONG
    // SHORT → forced SHORT
    // BOTH  → 200-level trend
    //
    // The AdvancedBot supplies forcedTrend for LONG/SHORT.
    //

    const activeTrendDirection =
      this.forcedTrend ||
      rawTrend.direction;


    const trend = {
      ...rawTrend,

      direction:
        activeTrendDirection,
    };


    // ============================================================
    // 3. ENTRY DEPTHS
    // ============================================================

    const depths =
      this.entryDepths.map(
        (depth) =>
          this.calculateDepth(
            snapshot,
            depth
          )
      );


    // ============================================================
    // 4. DETERMINE COUNTER-TREND
    // ============================================================

    let counterTrendDirection =
      "WAIT";


    if (
      trend.direction === "LONG"
    ) {
      counterTrendDirection =
        "SHORT";
    }


    if (
      trend.direction === "SHORT"
    ) {
      counterTrendDirection =
        "LONG";
    }


    const counterTrendCount =
      trend.direction === "WAIT"
        ? 0
        : depths.filter(
            (depthResult) =>
              depthResult.direction ===
              counterTrendDirection
          ).length;


    // ============================================================
    // 5. 3 OF 4 COUNTER-TREND TRIGGER
    // ============================================================

    const trigger =
      trend.direction !== "WAIT" &&
      counterTrendCount >=
        this.counterTrendRequired;


    // ============================================================
    // 6. FINAL DECISION
    // ============================================================

    const decision =
      trigger
        ? trend.direction
        : "WAIT";


    // ============================================================
    // 7. REASON
    // ============================================================

    let reason =
      "NO_COUNTER_TREND_TRIGGER";


    if (
      trend.direction === "WAIT"
    ) {
      reason =
        "NO_200_LEVEL_TREND";

    } else if (
      counterTrendCount >=
      this.counterTrendRequired
    ) {
      reason =
        `COUNTER_TREND_${counterTrendCount}_OF_${this.entryDepths.length}_CONFIRMED`;

    } else {
      reason =
        `COUNTER_TREND_${counterTrendCount}_OF_${this.entryDepths.length}`;
    }


    // ============================================================
    // RETURN
    // ============================================================

    return {
      trend: {
        depth:
          this.trendDepth,

        direction:
          trend.direction,

        // Raw 200-level information is still available.
        rawDirection:
          rawTrend.direction,

        forced:
          Boolean(this.forcedTrend),

        imbalance:
          rawTrend.imbalance,

        bidAskRatio:
          rawTrend.bidAskRatio,

        askBidRatio:
          rawTrend.askBidRatio,

        bidPercentage:
          rawTrend.bidPercentage,

        askPercentage:
          rawTrend.askPercentage,

        bidVolume:
          rawTrend.bidVolume,

        askVolume:
          rawTrend.askVolume,
      },

      depths,

      counterTrendDirection,

      counterTrendCount,

      counterTrendRequired:
        this.counterTrendRequired,

      trigger,

      decision,

      reason,

      receivedAt:
        snapshot.receivedAt ??
        new Date().toISOString(),

      lastUpdateId:
        snapshot.lastUpdateId ?? null,
    };
  }


  // ============================================================
  // GET CONFIG
  // ============================================================

  getConfig() {
    return {
      trendDepth:
        this.trendDepth,

      entryDepths: [
        ...this.entryDepths,
      ],

      longMinImbalance:
        this.longMinImbalance,

      shortMaxImbalance:
        this.shortMaxImbalance,

      minBidAskRatio:
        this.minBidAskRatio,

      minAskBidRatio:
        this.minAskBidRatio,

      counterTrendRequired:
        this.counterTrendRequired,

      forcedTrend:
        this.forcedTrend,
    };
  }
}


module.exports =
  OrderBookModule;