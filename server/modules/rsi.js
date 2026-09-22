class RSIModule {
  constructor(config = {}) {
    this.period = Number(config.period ?? 14);

    this.longEntry = Number(config.longEntry ?? 30);
    this.shortEntry = Number(config.shortEntry ?? 70);
  }

  // =======================================================
  // CALCULATE RSI
  // =======================================================

  calculate(closes) {
    if (!Array.isArray(closes)) {
      throw new Error("RSI requires an array of closing prices");
    }

    if (closes.length < this.period + 1) {
      throw new Error(
        `Not enough candles for RSI. Need at least ${
          this.period + 1
        }, received ${closes.length}`
      );
    }

    const prices = closes.map(Number);

    for (const price of prices) {
      if (!Number.isFinite(price)) {
        throw new Error("RSI received an invalid closing price");
      }
    }

    let gains = 0;
    let losses = 0;

    // First RSI calculation
    for (let i = 1; i <= this.period; i++) {
      const change = prices[i] - prices[i - 1];

      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }

    let averageGain = gains / this.period;
    let averageLoss = losses / this.period;

    // Continue through remaining candles
    for (let i = this.period + 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];

      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;

      averageGain =
        (averageGain * (this.period - 1) + gain) /
        this.period;

      averageLoss =
        (averageLoss * (this.period - 1) + loss) /
        this.period;
    }

    if (averageLoss === 0) {
      return 100;
    }

    const relativeStrength = averageGain / averageLoss;

    return 100 - 100 / (1 + relativeStrength);
  }

  // =======================================================
  // ENTRY DECISION
  // =======================================================

  getDecision(closes, direction) {
    const rsi = this.calculate(closes);

    const normalizedDirection = String(direction).toUpperCase();

    let decision = "WAIT";
    let reason = "RSI not in entry zone";

    if (
      normalizedDirection === "LONG" &&
      rsi <= this.longEntry
    ) {
      decision = "ENTER";
      reason = `RSI ${rsi.toFixed(2)} <= ${this.longEntry}`;
    }

    if (
      normalizedDirection === "SHORT" &&
      rsi >= this.shortEntry
    ) {
      decision = "ENTER";
      reason = `RSI ${rsi.toFixed(2)} >= ${this.shortEntry}`;
    }

    return {
      decision,
      direction: normalizedDirection,
      rsi: Number(rsi.toFixed(2)),
      reason,
    };
  }

  // =======================================================
  // CURRENT SETTINGS
  // =======================================================

  getConfig() {
    return {
      period: this.period,
      longEntry: this.longEntry,
      shortEntry: this.shortEntry,
    };
  }
}

module.exports = RSIModule;