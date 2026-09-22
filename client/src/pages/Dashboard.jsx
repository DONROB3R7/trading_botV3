import StatCard from "../components/common/StatCard";

export default function Dashboard({
  bots,
}) {
  const running =
    bots.filter(
      (bot) =>
        bot.status ===
        "RUNNING"
    ).length;

  const positions =
    bots.filter(
      (bot) =>
        bot.position?.status ===
        "OPEN"
    ).length;

  const trades =
    bots.reduce(
      (total, bot) =>
        total +
        (bot.statistics
          ?.totalTrades || 0),
      0
    );

  const pnl =
    bots.reduce(
      (total, bot) =>
        total +
        (bot.statistics
          ?.realizedPnl || 0),
      0
    );

  return (
    <div>
      <h1>
        Dashboard
      </h1>

      <p>
        WEEX Bot Lab overview.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginTop: 20,
        }}
      >
        <StatCard
          label="Total Bots"
          value={bots.length}
        />

        <StatCard
          label="Running"
          value={running}
        />

        <StatCard
          label="Open Positions"
          value={positions}
        />

        <StatCard
          label="Trades"
          value={trades}
        />

        <StatCard
          label="Realized P&L"
          value={`${pnl.toFixed(
            4
          )}%`}
        />
      </div>

      <div
        style={{
          marginTop: 30,
        }}
      >
        <h2>
          Active Bots
        </h2>

        {bots.length === 0 ? (
          <p>
            No bots created yet.
          </p>
        ) : (
          bots.map((bot) => (
            <div
              key={bot.id}
              style={{
                border:
                  "1px solid #ddd",
                borderRadius: 8,
                padding: 12,
                marginBottom: 8,
              }}
            >
              <strong>
                {bot.id}
              </strong>{" "}
              — {bot.symbol} —{" "}
              {bot.direction} —{" "}
              {bot.status}
            </div>
          ))
        )}
      </div>
    </div>
  );
}