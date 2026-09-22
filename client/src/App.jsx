import {
  useEffect,
  useState,
} from "react";

import {
  getBots,
  getSymbols,
  getHealth,
} from "./services/api";

import Dashboard from "./pages/Dashboard";
import BotManagement from "./pages/BotManagement";
import TradingStats from "./pages/TradingStats";
import Chart from "./pages/Chart";
import OrderBook from "./pages/OrderBook";
import Settings from "./pages/Settings";

export default function App() {
  const [
    currentPage,
    setCurrentPage,
  ] = useState("dashboard");

  const [
    bots,
    setBots,
  ] = useState([]);

  const [
    symbols,
    setSymbols,
  ] = useState([]);

  const [
    backendConnected,
    setBackendConnected,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  // =========================================================
  // LOAD BOTS
  // =========================================================

async function loadBots() {
  try {
    const result = await getBots();

    console.log("BOTS FROM API:", result);
    console.log("BOTS ARRAY:", result.data);

    setBots(Array.isArray(result.data) ? result.data : []);

    setBackendConnected(true);
    setError("");
  } catch (err) {
    setBackendConnected(false);
    setError(err.message);
  }
}

  // =========================================================
  // LOAD SYMBOLS
  // =========================================================

  async function loadSymbols() {
    try {
      const result =
        await getSymbols();

      setSymbols(
        result.symbols || []
      );
    } catch (err) {
      console.error(
        "Failed to load symbols:",
        err.message
      );
    }
  }

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    async function initialize() {
      setLoading(true);

      try {
        await getHealth();

        setBackendConnected(
          true
        );

        await Promise.all([
          loadBots(),
          loadSymbols(),
        ]);
      } catch (err) {
        setBackendConnected(
          false
        );

        setError(
          err.message
        );
      } finally {
        setLoading(false);
      }
    }

    initialize();
  }, []);

  // =========================================================
  // POLL BOTS
  // =========================================================

  useEffect(() => {
    const timer =
      setInterval(() => {
        loadBots();
      }, 5000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  // =========================================================
  // PAGE
  // =========================================================

  function renderPage() {
    if (
      currentPage ===
      "dashboard"
    ) {
      return (
        <Dashboard
          bots={bots}
        />
      );
    }

    if (
      currentPage ===
      "bots"
    ) {
      return (
        <BotManagement
          bots={bots}
          symbols={symbols}
          reloadBots={
            loadBots
          }
        />
      );
    }

    if (
      currentPage ===
      "stats"
    ) {
      return (
        <TradingStats
          bots={bots}
        />
      );
    }

    if (
      currentPage ===
      "chart"
    ) {
      return <Chart />;
    }

    if (
      currentPage ===
      "orderbook"
    ) {
      return <OrderBook />;
    }

    if (
      currentPage ===
      "settings"
    ) {
      return <Settings />;
    }

    return (
      <Dashboard
        bots={bots}
      />
    );
  }

  if (loading) {
    return (
      <div
        style={{
          padding: 30,
        }}
      >
        Loading WEEX Bot Lab...
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        fontFamily:
          "Arial, sans-serif",
      }}
    >
      {/* =====================================================
          TOP BAR
      ====================================================== */}

      <header
        style={{
          padding:
            "15px 20px",
          borderBottom:
            "1px solid #ddd",
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          gap: 15,
        }}
      >
        <div>
          <strong>
            🦍 WEEX BOT LAB
          </strong>
        </div>

        <div
          style={{
            fontSize: 13,
          }}
        >
          Backend:{" "}
          <strong
            style={{
              color:
                backendConnected
                  ? "green"
                  : "red",
            }}
          >
            {backendConnected
              ? "CONNECTED"
              : "OFFLINE"}
          </strong>
        </div>
      </header>

      {/* =====================================================
          APP LAYOUT
      ====================================================== */}

      <div
        style={{
          display: "flex",
          minHeight:
            "calc(100vh - 60px)",
        }}
      >
        {/* ===================================================
            NAVIGATION
        ==================================================== */}

        <aside
          style={{
            width: 210,
            borderRight:
              "1px solid #ddd",
            padding: 15,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "#777",
              marginBottom: 10,
            }}
          >
            NAVIGATION
          </div>

          <button
            onClick={() =>
              setCurrentPage(
                "dashboard"
              )
            }
            style={{
              display: "block",
              width: "100%",
              padding: 10,
              marginBottom: 6,
              textAlign: "left",
            }}
          >
            🏠 Dashboard
          </button>

          <button
            onClick={() =>
              setCurrentPage(
                "bots"
              )
            }
            style={{
              display: "block",
              width: "100%",
              padding: 10,
              marginBottom: 6,
              textAlign: "left",
            }}
          >
            🤖 Bot Management
          </button>

          <button
            onClick={() =>
              setCurrentPage(
                "stats"
              )
            }
            style={{
              display: "block",
              width: "100%",
              padding: 10,
              marginBottom: 6,
              textAlign: "left",
            }}
          >
            📊 Trading Stats
          </button>

          <button
            onClick={() =>
              setCurrentPage(
                "chart"
              )
            }
            style={{
              display: "block",
              width: "100%",
              padding: 10,
              marginBottom: 6,
              textAlign: "left",
            }}
          >
            📈 Chart
          </button>

          <button
            onClick={() =>
              setCurrentPage(
                "orderbook"
              )
            }
            style={{
              display: "block",
              width: "100%",
              padding: 10,
              marginBottom: 6,
              textAlign: "left",
            }}
          >
            📖 Order Book
          </button>

          <button
            onClick={() =>
              setCurrentPage(
                "settings"
              )
            }
            style={{
              display: "block",
              width: "100%",
              padding: 10,
              marginBottom: 6,
              textAlign: "left",
            }}
          >
            ⚙️ Settings
          </button>
        </aside>

        {/* ===================================================
            MAIN PAGE
        ==================================================== */}

        <main
          style={{
            flex: 1,
            padding: 25,
            minWidth: 0,
          }}
        >
          {error && (
            <div
              style={{
                padding: 12,
                marginBottom: 20,
                border:
                  "1px solid #e00",
                borderRadius: 8,
                color: "#b00000",
              }}
            >
              Backend error:{" "}
              {error}
            </div>
          )}

          {renderPage()}
        </main>
      </div>
    </div>
  );
}