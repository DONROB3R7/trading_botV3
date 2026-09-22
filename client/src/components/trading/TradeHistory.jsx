export default function TradeHistory({
  bots,
}) {
  const trades =
    bots.flatMap(
      (bot) =>
        Array.isArray(
          bot.tradeHistory
        )
          ? bot.tradeHistory.map(
              (trade) => ({
                ...trade,
                botId: bot.id,
              })
            )
          : []
    );

  return (
    <div
      style={{
        marginTop: 20,
        overflowX: "auto",
      }}
    >
      <h2>
        Trade History
      </h2>

      {!trades.length ? (
        <div>
          No completed trades yet.
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
              <th>Bot</th>
              <th>Symbol</th>
              <th>Direction</th>
              <th>Entry</th>
              <th>Exit</th>
              <th>P&L</th>
              <th>Result</th>
              <th>Reason</th>
            </tr>
          </thead>

          <tbody>
            {trades.map(
              (trade, index) => (
                <tr
                  key={`${trade.botId}-${trade.tradeNumber}-${index}`}
                >
                  <td>
                    {trade.tradeNumber}
                  </td>

                  <td>
                    {trade.botId}
                  </td>

                  <td>
                    {trade.symbol}
                  </td>

                  <td>
                    {trade.direction}
                  </td>

                  <td>
                    {trade.entryPrice}
                  </td>

                  <td>
                    {trade.exitPrice}
                  </td>

                  <td>
                    {trade.pnlPercent}%
                  </td>

                  <td>
                    {trade.result}
                  </td>

                  <td>
                    {trade.reason}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}