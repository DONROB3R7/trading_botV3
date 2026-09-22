import {
  useEffect,
  useState,
} from "react";

import {
  getOrderBook,
} from "../services/api";

function formatNumber(
  value,
  decimals = 4
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "-";
  }

  if (
    !Number.isFinite(
      Number(value)
    )
  ) {
    return String(value);
  }

  return Number(value).toFixed(
    decimals
  );
}

function getResultSymbol(
  result
) {
  if (result === "LONG") {
    return "🟢";
  }

  if (result === "SHORT") {
    return "🔴";
  }

  return "⚪";
}

function DepthCard({
  depth,
}) {
  return (
    <div
      style={{
        border:
          "1px solid #333",
        borderRadius:
          "8px",
        padding:
          "16px",
        marginBottom:
          "12px",
      }}
    >
      <div
        style={{
          display:
            "flex",
          justifyContent:
            "space-between",
          alignItems:
            "center",
          marginBottom:
            "14px",
        }}
      >
        <strong>
          {depth.depth} LEVELS
        </strong>

        <strong>
          {getResultSymbol(
            depth.result
          )}{" "}
          {depth.result}
        </strong>
      </div>

      <div
        style={{
          display:
            "grid",
          gridTemplateColumns:
            "repeat(4, 1fr)",
          gap:
            "12px",
        }}
      >
        <div>
          <div>
            Imbalance
          </div>

          <strong>
            {formatNumber(
              depth.imbalance,
              6
            )}
          </strong>
        </div>

        <div>
          <div>
            Bid Volume
          </div>

          <strong>
            {formatNumber(
              depth.bidVolume,
              4
            )}
          </strong>
        </div>

        <div>
          <div>
            Ask Volume
          </div>

          <strong>
            {formatNumber(
              depth.askVolume,
              4
            )}
          </strong>
        </div>

        <div>
          <div>
            Bid / Ask
          </div>

          <strong>
            {formatNumber(
              depth.bidAskRatio,
              4
            )}
          </strong>
        </div>
      </div>

      <div
        style={{
          marginTop:
            "12px",
        }}
      >
        Ask / Bid:{" "}
        <strong>
          {formatNumber(
            depth.askBidRatio,
            4
          )}
        </strong>
      </div>
    </div>
  );
}

export default function OrderBook() {
  const [
    symbol,
    setSymbol,
  ] = useState(
    "BTCUSDT"
  );

  const [
    data,
    setData,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    lastUpdated,
    setLastUpdated,
  ] = useState(null);

  async function loadOrderBook() {
    if (!symbol) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response =
        await getOrderBook(
          symbol.toUpperCase()
        );

      setData(
        response.data
      );

      setLastUpdated(
        new Date()
      );
    } catch (err) {
      setError(
        err.message
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrderBook();

    const interval =
      setInterval(
        loadOrderBook,
        5000
      );

    return () =>
      clearInterval(
        interval
      );
  }, [symbol]);

  const depths =
    data?.analysis?.depths ||
    [];

  const analysis =
    data?.analysis ||
    null;

  return (
    <div>
      <div
        style={{
          display:
            "flex",
          justifyContent:
            "space-between",
          alignItems:
            "center",
          marginBottom:
            "20px",
        }}
      >
        <div>
          <h1>
            Order Book
          </h1>

          <p>
            Live WEEX Order Book
            Entry Model
          </p>
        </div>

        <div
          style={{
            display:
              "flex",
            gap:
              "10px",
          }}
        >
          <input
            value={symbol}
            onChange={(event) =>
              setSymbol(
                event.target.value.toUpperCase()
              )
            }
            placeholder="BTCUSDT"
            style={{
              padding:
                "10px",
            }}
          />

          <button
            onClick={
              loadOrderBook
            }
          >
            Refresh
          </button>
        </div>
      </div>

      {loading &&
        !data && (
          <p>
            Loading WEEX order
            book...
          </p>
        )}

      {error && (
        <div
          style={{
            border:
              "1px solid #a33",
            padding:
              "12px",
            marginBottom:
              "16px",
          }}
        >
          Error: {error}
        </div>
      )}

      {analysis && (
        <>
          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "repeat(4, 1fr)",
              gap:
                "12px",
              marginBottom:
                "20px",
            }}
          >
            <div
              style={{
                border:
                  "1px solid #333",
                padding:
                  "16px",
                borderRadius:
                  "8px",
              }}
            >
              <div>
                SYMBOL
              </div>

              <strong>
                {data.symbol}
              </strong>
            </div>

            <div
              style={{
                border:
                  "1px solid #333",
                padding:
                  "16px",
                borderRadius:
                  "8px",
              }}
            >
              <div>
                FINAL DECISION
              </div>

              <strong>
                {getResultSymbol(
                  analysis.decision
                )}{" "}
                {analysis.decision}
              </strong>
            </div>

            <div
              style={{
                border:
                  "1px solid #333",
                padding:
                  "16px",
                borderRadius:
                  "8px",
              }}
            >
              <div>
                CONFIRMATION
              </div>

              <strong>
                {
                  analysis.confirmationCount
                }
                /
                {
                  analysis.totalDepths
                }
              </strong>
            </div>

            <div
              style={{
                border:
                  "1px solid #333",
                padding:
                  "16px",
                borderRadius:
                  "8px",
              }}
            >
              <div>
                LAST UPDATE
              </div>

              <strong>
                {lastUpdated
                  ? lastUpdated.toLocaleTimeString()
                  : "-"}
              </strong>
            </div>
          </div>

          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "repeat(3, 1fr)",
              gap:
                "12px",
              marginBottom:
                "20px",
            }}
          >
            <div>
              LONG{" "}
              <strong>
                {analysis.longCount}
              </strong>
            </div>

            <div>
              SHORT{" "}
              <strong>
                {analysis.shortCount}
              </strong>
            </div>

            <div>
              WAIT{" "}
              <strong>
                {analysis.waitCount}
              </strong>
            </div>
          </div>

          <div>
            <h2>
              Depth Analysis
            </h2>

            {depths.map(
              (depth) => (
                <DepthCard
                  key={
                    depth.depth
                  }
                  depth={
                    depth
                  }
                />
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}