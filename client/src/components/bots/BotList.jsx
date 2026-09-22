import BotCard from "./BotCard";

export default function BotList({
  bots,
  onChanged,
}) {
  if (
    !bots ||
    bots.length === 0
  ) {
    return (
      <div>
        No bots created yet.
      </div>
    );
  }

  return (
    <div>
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