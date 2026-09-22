import TradeStats from "../components/trading/TradeStats";
import TradeHistory from "../components/trading/TradeHistory";

export default function TradingStats({
  bots,
}) {
  return (
    <div>
      <h1>
        Trading Statistics
      </h1>

      <p>
        Combined statistics from
        all bots.
      </p>

      <TradeStats
        bots={bots}
      />

      <TradeHistory
        bots={bots}
      />
    </div>
  );
}