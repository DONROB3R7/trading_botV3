import CreateBotForm from "../components/bots/CreateBotForm";
import BotList from "../components/bots/BotList";

import "./BotManagement.css";

export default function BotManagement({
  bots,
  symbols,
  reloadBots,
}) {
  const safeBots = Array.isArray(bots)
    ? bots
    : [];

  return (
    <div className="bot-management">

      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="bot-management-header">

        <div>

          <div className="bot-title-row">

            <span className="bot-title-icon">
              🤖
            </span>

            <h1>
              Bot Management
            </h1>

          </div>

          <p>
            Create, start, stop and manage
            your trading bots.
          </p>

        </div>

        <div className="bot-count">

          <span className="bot-count-number">
            {safeBots.length}
          </span>

          <span className="bot-count-label">
            BOTS
          </span>

        </div>

      </div>

      {/* =====================================================
          CREATE BOT
      ====================================================== */}

      <section className="bot-section">

        <div className="section-header">

          <div>

            <h2>
              🍌 Create Bot
            </h2>

            <p>
              Caveman wants another bot.
            </p>

          </div>

        </div>

        <div className="create-bot-card">
          <CreateBotForm
            onCreated={reloadBots}
          />
        </div>

      </section>

      {/* =====================================================
          BOT LIST
      ====================================================== */}

      <section className="bot-section">

        <div className="section-header">

          <div>

            <h2>
              🤖 Your Bots
            </h2>

            <p>
              Keep an eye on the little
              money machines.
            </p>

          </div>

          <div className="bot-section-status">

            {safeBots.length === 0 ? (
              <span className="no-bots">
                🦍 No bots yet
              </span>
            ) : (
              <span className="bots-ready">
                🟢 {safeBots.length} bot
                {safeBots.length !== 1
                  ? "s"
                  : ""} ready
              </span>
            )}

          </div>

        </div>

        <div className="bot-list-card">

          <BotList
            bots={safeBots}
            onChanged={reloadBots}
          />

        </div>

      </section>

      {/* =====================================================
          CAVEMAN MESSAGE
      ====================================================== */}

      <div className="bot-management-footer">

        <span className="footer-monkey">
          🐒
        </span>

        <span>
          Caveman wisdom:
        </span>

        <strong>
          More bots ≠ more bananas.
        </strong>

        <span>
          🍌
        </span>

      </div>

    </div>
  );
}