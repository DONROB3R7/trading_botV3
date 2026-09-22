import CreateBotForm from "../components/bots/CreateBotForm";
import BotList from "../components/bots/BotList";

export default function BotManagement({
  bots,
  reloadBots,
}) {
  return (
    <div>
      <h1>
        Bot Management
      </h1>

      <CreateBotForm
        onCreated={
          reloadBots
        }
      />

      <hr
        style={{
          margin:
            "24px 0",
        }}
      />

      <h2>
        Bots
      </h2>

      <BotList
        bots={
          Array.isArray(bots)
            ? bots
            : []
        }
        onChanged={
          reloadBots
        }
      />
    </div>
  );
}