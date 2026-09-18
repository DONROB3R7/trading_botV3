const express = require("express");
const cors = require("cors");

const {
  getTradingSymbols,
  getExchangeInfo,
  getTicker,
} = require("./market/marketData");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "WEEX Bot Lab backend is alive",
  });
});

app.get("/api/market/symbols", async (req, res) => {
  try {
    const symbols = await getTradingSymbols();

    res.json({
      success: true,
      count: symbols.length,
      symbols,
    });
  } catch (error) {
    console.error("[Symbols]", error.message);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/api/market/exchange-info", async (req, res) => {
  try {
    const data = await getExchangeInfo();

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("[ExchangeInfo]", error.message);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/api/market/ticker/:symbol", async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    const data = await getTicker(symbol);

    res.json({
      success: true,
      symbol,
      data,
    });
  } catch (error) {
    console.error("[Ticker]", error.message);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(
    `🦍 WEEX Bot Lab server running on http://localhost:${PORT}`
  );
});