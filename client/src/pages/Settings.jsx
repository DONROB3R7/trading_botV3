import {
  useEffect,
  useState,
} from "react";

import {
  getSettings,
  saveSettings,
} from "../services/api";

const DEFAULT_MARGIN = 0.5;
const DEFAULT_LEVERAGE = 10;

export default function Settings() {
  const [marginUSDT, setMarginUSDT] =
    useState(
      DEFAULT_MARGIN.toString()
    );

  const [leverage, setLeverage] =
    useState(
      DEFAULT_LEVERAGE.toString()
    );

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  // ==========================================================
  // LOAD SETTINGS FROM BACKEND
  // ==========================================================

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const result =
          await getSettings();

        const settings =
          result?.data || {};

        setMarginUSDT(
          Number(
            settings.marginUSDT ??
              DEFAULT_MARGIN
          ).toString()
        );

        setLeverage(
          Number(
            settings.leverage ??
              DEFAULT_LEVERAGE
          ).toString()
        );
      } catch (err) {
        console.error(
          "[Settings] Load failed:",
          err
        );

        setError(
          err.message ||
            "Failed to load settings."
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  // ==========================================================
  // SAVE SETTINGS TO BACKEND
  // ==========================================================

  async function handleSave() {
    const margin =
      Number(marginUSDT);

    const lev =
      Number(leverage);

    if (
      !Number.isFinite(margin) ||
      margin <= 0
    ) {
      setError(
        "Margin must be greater than 0."
      );

      return;
    }

    if (
      !Number.isFinite(lev) ||
      lev <= 0
    ) {
      setError(
        "Leverage must be greater than 0."
      );

      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const result =
        await saveSettings({
          marginUSDT: margin,
          leverage: lev,
        });

      const settings =
        result?.data || {};

      setMarginUSDT(
        Number(
          settings.marginUSDT
        ).toString()
      );

      setLeverage(
        Number(
          settings.leverage
        ).toString()
      );

      setMessage(
        "Settings saved."
      );
    } catch (err) {
      console.error(
        "[Settings] Save failed:",
        err
      );

      setError(
        err.message ||
          "Failed to save settings."
      );
    } finally {
      setSaving(false);
    }
  }

  // ==========================================================
  // RESET
  // ==========================================================

  async function handleReset() {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      const result =
        await saveSettings({
          marginUSDT:
            DEFAULT_MARGIN,

          leverage:
            DEFAULT_LEVERAGE,
        });

      const settings =
        result?.data || {};

      setMarginUSDT(
        Number(
          settings.marginUSDT ??
            DEFAULT_MARGIN
        ).toString()
      );

      setLeverage(
        Number(
          settings.leverage ??
            DEFAULT_LEVERAGE
        ).toString()
      );

      setMessage(
        "Settings reset."
      );
    } catch (err) {
      console.error(
        "[Settings] Reset failed:",
        err
      );

      setError(
        err.message ||
          "Failed to reset settings."
      );
    } finally {
      setSaving(false);
    }
  }

  const targetNotional =
    Number(marginUSDT || 0) *
    Number(leverage || 0);

  // ==========================================================
  // UI
  // ==========================================================

  if (loading) {
    return (
      <div
        style={{
          padding: 24,
        }}
      >
        <h1>Settings</h1>

        <p>
          Loading settings...
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 24,
        maxWidth: 700,
      }}
    >
      <h1
        style={{
          marginBottom: 8,
        }}
      >
        Settings
      </h1>

      <p
        style={{
          marginTop: 0,
          color: "#666",
        }}
      >
        Global WEEX Bot Lab settings.
      </p>

      <div
        style={{
          border:
            "1px solid #d9e2f0",
          borderRadius: 10,
          padding: 24,
          marginTop: 24,
          background: "#fff",
        }}
      >
        <h2
          style={{
            marginTop: 0,
            marginBottom: 20,
          }}
        >
          Trading Defaults
        </h2>

        <div
          style={{
            display: "grid",
            gap: 20,
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              Default Margin (USDT)
            </label>

            <input
              type="number"
              min="0.01"
              step="0.01"
              value={marginUSDT}
              onChange={(event) =>
                setMarginUSDT(
                  event.target.value
                )
              }
              style={{
                width: "100%",
                boxSizing:
                  "border-box",
                padding:
                  "10px 12px",
                border:
                  "1px solid #b8c7d9",
                borderRadius: 6,
                fontSize: 16,
              }}
            />

            <div
              style={{
                marginTop: 6,
                fontSize: 13,
                color: "#777",
              }}
            >
              Target margin for new
              bot positions.
            </div>
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              Default Leverage (x)
            </label>

            <input
              type="number"
              min="1"
              step="1"
              value={leverage}
              onChange={(event) =>
                setLeverage(
                  event.target.value
                )
              }
              style={{
                width: "100%",
                boxSizing:
                  "border-box",
                padding:
                  "10px 12px",
                border:
                  "1px solid #b8c7d9",
                borderRadius: 6,
                fontSize: 16,
              }}
            />
          </div>
        </div>

        <div
          style={{
            marginTop: 24,
            padding: 14,
            background:
              "#f5f8fc",
            borderRadius: 8,
            border:
              "1px solid #e1e8f0",
          }}
        >
          <strong>
            Target Notional:
          </strong>{" "}
          {targetNotional.toFixed(2)}{" "}
          USDT
        </div>

        {error && (
          <div
            style={{
              marginTop: 20,
              padding: 12,
              borderRadius: 6,
              background: "#fff1f1",
              border:
                "1px solid #e0aaaa",
              color: "#a00000",
            }}
          >
            {error}
          </div>
        )}

        {message && (
          <div
            style={{
              marginTop: 20,
              padding: 12,
              borderRadius: 6,
              background: "#eef9f1",
              border:
                "1px solid #b7d9c0",
              color: "#176b2c",
            }}
          >
            {message}
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 24,
          }}
        >
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding:
                "10px 18px",
              border: "none",
              borderRadius: 6,
              background:
                "#1976d2",
              color: "#fff",
              cursor: saving
                ? "default"
                : "pointer",
              fontWeight: 600,
              opacity: saving
                ? 0.7
                : 1,
            }}
          >
            {saving
              ? "Saving..."
              : "Save Settings"}
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            style={{
              padding:
                "10px 18px",
              border:
                "1px solid #b8c7d9",
              borderRadius: 6,
              background: "#fff",
              color: "#333",
              cursor: saving
                ? "default"
                : "pointer",
              fontWeight: 600,
            }}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}