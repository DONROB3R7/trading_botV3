import StatCard from "../common/StatCard";

export default function TradeStats({
  bots,
}) {
  const allTrades =
    bots.flatMap(
      (bot) =>
        Array.isArray(
          bot.tradeHistory
        )
          ? bot.tradeHistory
          : []
    );

  const wins =
    allTrades.filter(
      (trade) =>
        trade.pnlPercent > 0
    ).length;

  const losses =
    allTrades.filter(
      (trade) =>
        trade.pnlPercent < 0
    ).length;

  const pnl =
    allTrades.reduce(
      (total, trade) =>
        total +
        Number(
          trade.pnlPercent || 0
        ),
      0
    );

  const winRate =
    allTrades.length
      ? (wins /
          allTrades.length) *
        100
      : 0;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 12,
      }}
    >
      <StatCard
        label="Total Trades"
        value={
          allTrades.length
        }
      />

      <StatCard
        label="Wins"
        value={wins}
      />

      <StatCard
        label="Losses"
        value={losses}
      />

      <StatCard
        label="Win Rate"
        value={`${winRate.toFixed(
          2
        )}%`}
      />

      <StatCard
        label="Realized P&L"
        value={`${pnl.toFixed(
          4
        )}%`}
      />
    </div>
  );
}