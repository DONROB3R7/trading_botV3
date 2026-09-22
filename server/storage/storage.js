const fs = require("fs");
const path = require("path");

const STORAGE_DIR = __dirname;
const STORAGE_FILE = path.join(
  STORAGE_DIR,
  "bots.json"
);

// =========================================================
// ENSURE STORAGE EXISTS
// =========================================================

function ensureStorage() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, {
      recursive: true,
    });
  }

  if (!fs.existsSync(STORAGE_FILE)) {
    fs.writeFileSync(
      STORAGE_FILE,
      JSON.stringify(
        {
          bots: [],
        },
        null,
        2
      )
    );
  }
}

// =========================================================
// LOAD
// =========================================================

function loadBots() {
  ensureStorage();

  try {
    const text =
      fs.readFileSync(
        STORAGE_FILE,
        "utf8"
      );

    const data =
      JSON.parse(text);

    if (
      !data ||
      !Array.isArray(data.bots)
    ) {
      return [];
    }

    return data.bots;
  } catch (error) {
    console.error(
      "[Storage] Failed to load bots:",
      error.message
    );

    return [];
  }
}

// =========================================================
// SAVE
// =========================================================

function saveBots(bots) {
  ensureStorage();

  fs.writeFileSync(
    STORAGE_FILE,
    JSON.stringify(
      {
        bots,
      },
      null,
      2
    )
  );
}

module.exports = {
  loadBots,
  saveBots,
};