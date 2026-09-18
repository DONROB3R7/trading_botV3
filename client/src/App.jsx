import { useEffect, useState } from "react";

function App() {
  const [symbols, setSymbols] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [ticker, setTicker] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadSymbols();
  }, []);

  async function loadSymbols() {
    try {
      const response = await fetch(
        "http://localhost:3001/api/market/symbols"
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to load symbols");
      }

      setSymbols(result.symbols);

      if (result.symbols.length > 0) {
        setSelectedSymbol(result.symbols[0]);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (!selectedSymbol) {
      return;
    }

    loadTicker(selectedSymbol);

    const interval = setInterval(() => {
      loadTicker(selectedSymbol);
    }, 2000);

    return () => clearInterval(interval);
  }, [selectedSymbol]);

  async function loadTicker(symbol) {
    try {
      const response = await fetch(
        `http://localhost:3001/api/market/ticker/${symbol}`
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to load ticker");
      }

      setTicker(result.data);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{ padding: "30px", fontFamily: "Arial" }}>
      <h1>🦍 WEEX Bot Lab</h1>

      <p>
        Backend:{" "}
        <strong style={{ color: "green" }}>
          CONNECTED
        </strong>
      </p>

      <hr />

      <h2>Market</h2>

      <select
        value={selectedSymbol}
        onChange={(event) => setSelectedSymbol(event.target.value)}
        style={{
          padding: "10px",
          minWidth: "250px",
          fontSize: "16px",
        }}
      >
        {symbols.map((symbol) => (
          <option key={symbol} value={symbol}>
            {symbol}
          </option>
        ))}
      </select>

      {selectedSymbol && (
        <div style={{ marginTop: "30px" }}>
          <h2>{selectedSymbol}</h2>

          {ticker && (
            <div>
              <p>
                Bid: <strong>{ticker[0]?.bidPrice}</strong>
              </p>

              <p>
                Ask: <strong>{ticker[0]?.askPrice}</strong>
              </p>

              <p>
                Spread:{" "}
                <strong>
                  {(
                    Number(ticker[0]?.askPrice) -
                    Number(ticker[0]?.bidPrice)
                  ).toFixed(8)}
                </strong>
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <p style={{ color: "red" }}>
          Error: {error}
        </p>
      )}
    </div>
  );
}

export default App;