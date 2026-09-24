import BotCard from "./BotCard";
import "./BotList.css";

export default function BotList({
  bots,
  onChanged,
}) {
  if (
    !bots ||
    bots.length === 0
  ) {
    return (
      <div className="bot-list-empty">
        <div className="empty-icon">🦍</div>

        <h3>No bots created yet</h3>

        <p>
          Caveman has no bots. Time to make banana machine. 🍌
        </p>
      </div>
    );
  }

  return (
    <div className="bot-list">
      {bots.map(
        (bot) => (
          <BotCard
            key={bot.id}
            bot={bot}
            onChanged={
              onChanged
            }
          />
        )
      )}
    </div>
  );
}