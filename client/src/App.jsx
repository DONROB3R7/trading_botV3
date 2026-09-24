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

import "./pages/App.css";

export default function App() {
  const [currentPage, setCurrentPage] =
    useState("dashboard");

  const [bots, setBots] = useState([]);

  const [symbols, setSymbols] =
    useState([]);

  const [backendConnected, setBackendConnected] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  // =========================================================
  // LOAD BOTS
  // =========================================================

  async function loadBots() {
    try {
      const result = await getBots();

      console.log(
        "BOTS FROM API:",
        result
      );

      console.log(
        "BOTS ARRAY:",
        result.data
      );

      setBots(
        Array.isArray(result.data)
          ? result.data
          : []
      );

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

        setBackendConnected(true);

        await Promise.all([
          loadBots(),
          loadSymbols(),
        ]);
      } catch (err) {
        setBackendConnected(false);
        setError(err.message);
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
    if (currentPage === "dashboard") {
      return <Dashboard bots={bots} />;
    }

    if (currentPage === "bots") {
      return (
        <BotManagement
          bots={bots}
          symbols={symbols}
          reloadBots={loadBots}
        />
      );
    }

    if (currentPage === "stats") {
      return <TradingStats bots={bots} />;
    }

    if (currentPage === "chart") {
      return <Chart />;
    }

    if (currentPage === "orderbook") {
      return <OrderBook />;
    }

    if (currentPage === "settings") {
      return <Settings />;
    }

    return <Dashboard bots={bots} />;
  }

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="app-loading">

        <div className="loading-jungle">

          <span className="loading-monkey">
            🐒
          </span>

          <span className="loading-banana">
            🍌
          </span>

          <span className="loading-rock">
            🪨
          </span>

          <span className="loading-gorilla">
            🦍
          </span>

        </div>

        <div className="loading-title">
          Caveman is waking the bots...
        </div>

        <div className="loading-subtitle">
          Please do not feed the algorithm.
        </div>

      </div>
    );
  }

  // =========================================================
  // APP
  // =========================================================

  return (
    <div className="app">

      {/* ===================================================
          HEADER
      ==================================================== */}

      <header className="app-header">

        <div className="app-brand">

          <div className="brand-monkey">
            🦍
          </div>

          <div className="brand-text">

            <strong>
              WEEX BOT LAB
            </strong>

            <span>
              🪨 Caveman Trading Department 🍌
            </span>

          </div>

        </div>

        <div className="backend-status">

          <span>
            Backend:
          </span>

          <span
            className={
              backendConnected
                ? "status-online"
                : "status-offline"
            }
          >
            ●{" "}
            {backendConnected
              ? "CONNECTED"
              : "OFFLINE"}
          </span>

        </div>

      </header>

      {/* ===================================================
          NAVIGATION
      ==================================================== */}

      <nav className="app-nav">

        <button
          className={
            currentPage === "dashboard"
              ? "nav-button active"
              : "nav-button"
          }
          onClick={() =>
            setCurrentPage("dashboard")
          }
        >
          🏠 Dashboard
        </button>

        <button
          className={
            currentPage === "bots"
              ? "nav-button active"
              : "nav-button"
          }
          onClick={() =>
            setCurrentPage("bots")
          }
        >
          🤖 Bot Management
        </button>

        <button
          className={
            currentPage === "stats"
              ? "nav-button active"
              : "nav-button"
          }
          onClick={() =>
            setCurrentPage("stats")
          }
        >
          📊 Trading Stats
        </button>

        <button
          className={
            currentPage === "chart"
              ? "nav-button active"
              : "nav-button"
          }
          onClick={() =>
            setCurrentPage("chart")
          }
        >
          📈 Chart
        </button>

        <button
          className={
            currentPage === "orderbook"
              ? "nav-button active"
              : "nav-button"
          }
          onClick={() =>
            setCurrentPage("orderbook")
          }
        >
          📖 Order Book
        </button>

        <button
          className={
            currentPage === "settings"
              ? "nav-button active"
              : "nav-button"
          }
          onClick={() =>
            setCurrentPage("settings")
          }
        >
          ⚙️ Settings
        </button>

      </nav>

      {/* ===================================================
          MAIN CENTER AREA
      ==================================================== */}

      <div className="app-content">

        <main className="app-main">

          {error && (
            <div className="app-error">
              <strong>
                Backend error:
              </strong>{" "}
              {error}
            </div>
          )}

          {renderPage()}

        </main>

      </div>

      {/* ===================================================
          CAVEMAN FOOTER
      ==================================================== */}

      <footer className="caveman-footer">

        <div className="footer-jungle">

          <span>🌴</span>
          <span>🐒</span>
          <span>🍌</span>

          <span className="footer-caveman">
            🦍
          </span>

          <span>🍌</span>
          <span>🐒</span>
          <span>🌴</span>

        </div>

        <div className="footer-text">
          Caveman says:
          <strong>
            {" "}code first, panic later.
          </strong>
        </div>

        <div className="footer-rock">
          🪨
        </div>

      </footer>

    </div>
  );
}