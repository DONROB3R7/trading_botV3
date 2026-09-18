# trading_botV3
# WEEX Modular Trading Bot — Design V1

## Status

🚧 DESIGN / PLANNING ONLY

This project is a completely clean restart.

The purpose of this project is to design a modular WEEX trading bot system before writing the actual implementation.

The architecture should stay simple at the beginning and allow more advanced functionality to be added later without rebuilding the whole project.

---

# 1. Main Idea

The bot should NOT be one giant strategy.

Instead, we build a small bot engine that can use different modules.

Basic idea:

WEEX
↓
Market Data
↓
Bot
↓
Entry Model
↓
TP / SL
↓
Execution

The first bot should be simple.

Example:

    COIN
    CAKEUSDT

    DIRECTION
    LONG

    ENTRY MODEL
    RSI

    TP
    1.00%

    SL
    0.80%

The more complicated systems should only be added when we actually need them.

---

# 2. Simple Bot

The first bot configuration should be approximately:

    ┌──────────────────────────────────────┐
    │              BOT CONFIG              │
    ├──────────────────────────────────────┤
    │                                      │
    │ COIN                                 │
    │ [ CAKEUSDT                       ▼ ] │
    │                                      │
    │ DIRECTION                            │
    │ [ LONG                           ▼ ] │
    │                                      │
    │ ENTRY MODEL                          │
    │ [ RSI                            ▼ ] │
    │                                      │
    │ TP                                   │
    │ [ 1.00 %                         ]   │
    │                                      │
    │ SL                                   │
    │ [ 0.80 %                         ]   │
    │                                      │
    │ [ START BOT ]                        │
    │                                      │
    └──────────────────────────────────────┘

The simple bot should NOT automatically contain:

- Kill Zone
- Multiple entries
- Cycle system
- Pyramiding
- Complex direction logic
- Advanced risk management

Those features can belong to other bot versions later.

---

# 3. Bot Versions

Not every trading idea needs the same configuration.

The system should eventually support different bot versions.

Example:

    BOT VERSION

    [ SIMPLE ▼ ]

        SIMPLE
        NORMAL
        COMPLEX
        CUSTOM

The exact versions are not finalized.

The important idea is:

A simple bot stays simple.

A complex bot can expose additional settings.

---

# 4. Simple Version

Possible configuration:

    COIN
    DIRECTION
    ENTRY MODEL
    TP %
    SL %

Example:

    CAKEUSDT
    LONG
    RSI
    TP 1.00%
    SL 0.80%

---

# 5. Future Normal Version

A normal bot could eventually have:

    COIN
    DIRECTION
    DIRECTION MODEL
    ENTRY MODEL
    CYCLE
    TP %
    SL %

Example:

    BTCUSDT

    DIRECTION MODEL
    SMA20

    ENTRY MODEL
    TRADE FLOW

    CYCLE
    10 minutes

    TP
    1%

    SL
    0.8%

This is only a future concept.

---

# 6. Future Complex Version

A complex bot could eventually contain things such as:

    DIRECTION MODEL
    ENTRY MODEL
    CONFIRMATION MODEL
    KILL ZONE
    MAX ENTRIES
    CYCLE
    TP MODEL
    SL MODEL
    POSITION MANAGEMENT

Again, these features should NOT be forced into the simple bot.

---

# 7. Entry Models

Entry models are independent modules.

Possible modules:

    RSI
    SMA
    Order Book
    Trade Flow
    Pullback
    Price Action
    etc.

Initial focus:

    RSI
    SMA

Additional models can be added later.

---

# 8. RSI Module

RSI should be its own module.

Possible settings:

    RSI PERIOD
    14

    RSI ENTRY LEVEL
    30

    RSI RESET / EXIT LEVEL
    50

These are examples only.

The exact RSI logic will be designed before implementation.

The important concept is:

The RSI module owns the RSI logic.

The main bot does not contain RSI-specific code.

---

# 9. SMA Module

SMA should also be its own module.

Possible settings:

    SMA PERIOD
    20

    TIMEFRAME
    15m

    RULE
    ABOVE / BELOW SMA

Again, the exact logic will be designed later.

The SMA module owns SMA logic.

---

# 10. Module Defaults

Every module should have default settings.

Example:

RSI:

    Period = 14
    Entry = 30
    Reset = 50

SMA:

    Period = 20
    Timeframe = 15m

The dashboard should display the defaults.

The user can then change them.

Concept:

    Module
       ↓
    Default settings
       ↓
    Dashboard
       ↓
    User changes settings
       ↓
    Bot receives configuration

This keeps the general bot configuration clean.

---

# 11. Combining Entry Models

Eventually we may want to combine modules.

Example:

    ENTRY MODELS

    ☑ RSI
    ☑ SMA
    ☐ Order Book
    ☐ Trade Flow

Possible future logic:

    RSI AND SMA

or:

    RSI OR Order Book

This is NOT part of the first implementation.

First make one entry model work correctly.

Then design combinations.

---

# 12. Direction

Direction should initially remain simple.

Example:

    DIRECTION

    [ LONG ▼ ]

Possible values:

    LONG
    SHORT

Later, direction itself could become modular.

For example:

    DIRECTION MODEL

    MANUAL
    SMA20
    SMA50
    SMA200
    etc.

This would allow a bot where the user manually chooses LONG/SHORT and another bot where an indicator determines direction.

This is a future design idea.

---

# 13. Chart

The dashboard should include a market chart.

Example:

    ┌──────────────────────────────────────────────┐
    │ CAKEUSDT                         15m          │
    │                                              │
    │                  Candles                     │
    │                                              │
    │                     SMA 20                   │
    │                                              │
    │                          ↑ ENTRY             │
    │                                              │
    └──────────────────────────────────────────────┘

    ┌──────────────────────────────────────────────┐
    │ RSI                                          │
    │                                              │
    │ RSI line                                     │
    │                                              │
    │ ───────────────────────────── 70             │
    │                                              │
    │ ───────────────────────────── 30             │
    └──────────────────────────────────────────────┘

The chart should use the same market data that the bot uses.

We should avoid having the dashboard display one data source while the bot calculates using another.

Future chart features could include:

- Entry markers
- Exit markers
- TP line
- SL line
- Indicators
- Bot status
- Historical trades
- Order Book information
- Trade Flow information

Only add these when they are useful.

---

# 14. Coin Selection

The coin list should come from WEEX.

We should not manually maintain a list such as:

    BTC
    ETH
    CAKE
    SOL
    etc.

Instead:

    WEEX
      ↓
    Available trading symbols
      ↓
    Backend
      ↓
    React
      ↓
    Coin Selector

The dashboard should allow the user to select a supported coin.

Example:

    COIN

    [ CAKEUSDT ▼ ]

    BTCUSDT
    CAKEUSDT
    SOLUSDT
    ETHUSDT
    ...

The exact WEEX symbol-discovery implementation will be decided during development.

---

# 15. Multiple Bot Instances

The system should eventually allow several bots to run independently.

Example:

    BOT MANAGER

    CAKEUSDT
    └── Simple Bot
        └── RSI

    BTCUSDT
    └── Simple Bot
        └── SMA

    SOLUSDT
    └── Simple Bot
        └── RSI

Each bot instance should have its own:

- Coin
- Direction
- Entry Model
- Indicator settings
- TP
- SL
- Position state
- Execution state

One bot must not accidentally affect another bot.

---

# 16. High-Level Architecture

Initial concept:

    React Dashboard
           ↓
    Node.js Backend
           ↓
      Bot Manager
           ↓
       Bot Instance
           ↓
      Entry Model
           ↓
       Risk / TP / SL
           ↓
      Execution Service
           ↓
          WEEX

---

# 17. React Responsibilities

React should handle:

- Dashboard
- Bot configuration
- Coin selection
- Chart
- Indicator settings
- Start / Stop
- Bot status
- Active bot display
- Entry model configuration

React should NOT directly place WEEX orders.

---

# 18. Node.js Responsibilities

Node should handle:

- Bot Manager
- Bot instances
- Market data
- Indicator calculations
- Entry decisions
- TP calculation
- SL calculation
- Position monitoring
- WEEX communication
- Order execution
- Bot state

---

# 19. Entry Module Responsibilities

An entry module should contain its own strategy logic.

Example:

    RSI MODULE

    Market data
        ↓
    Calculate RSI
        ↓
    Apply RSI rules
        ↓
    Entry decision

Possible result:

    ENTER

or:

    WAIT

Similarly:

    SMA MODULE

    Market data
        ↓
    Calculate SMA
        ↓
    Apply SMA rules
        ↓
    Entry decision

The exact interface between the Bot Engine and modules still needs to be designed.

---

# 20. Execution

Entry models should NOT directly place WEEX orders.

The architecture should be:

    Entry Model
         ↓
    Entry Decision
         ↓
    Bot Engine
         ↓
    Execution Service
         ↓
    WEEX

This keeps strategy logic separate from exchange execution.

---

# 21. TP / SL

The simple bot should have percentage-based TP and SL.

Example:

    TP = 1.00%
    SL = 0.80%

For LONG:

    Entry
      ↓
    TP above entry
    SL below entry

For SHORT:

    Entry
      ↓
    TP below entry
    SL above entry

The exact handling of:

- exchange TP/SL
- local monitoring
- position averaging
- partial fills
- emergency closing

still needs to be designed.

---

# 22. Future Advanced Trading System

The previous design discussed a more advanced manual-trading-style bot.

Possible future configuration:

    COIN
    CAKEUSDT

    DIRECTION
    LONG

    DIRECTION MODEL
    MANUAL

    KILL ZONE
    2.50

    MAX ENTRIES
    10

    ENTRY MODEL
    RSI

    CYCLE
    10 minutes

    TP
    1%

    SL
    SAVED %

This system is still a future idea.

It should NOT be forced into the first simple bot.

---

# 23. Advanced Bot Philosophy

The advanced system would behave more like a manual trading thesis executed by software.

Example:

    User decides:

    CAKE
    LONG

    Bot then:

    Finds entries
    ↓
    Adds entries according to rules
    ↓
    Tracks average price
    ↓
    Uses TP
    ↓
    Uses SL
    ↓
    Handles the cycle

This is different from a bot that automatically tries to predict market direction.

This distinction should remain clear.

---

# 24. Important Design Principles

## Keep simple things simple

Do not add advanced options to every bot.

## Modules should be independent

RSI should not know how SMA works.

SMA should not know how Trade Flow works.

## Execution should be centralized

Strategies decide.

Execution executes.

## Defaults belong to modules

RSI owns its default RSI settings.

SMA owns its default SMA settings.

## Dashboard controls configuration

React should allow the user to change module settings.

## Bot instances are independent

CAKE and BTC should have independent state.

## Build gradually

Start with:

    Simple Bot
        ↓
    Chart
        ↓
    RSI
        ↓
    SMA
        ↓
    TP / SL
        ↓
    Execution

Then expand.

---

# 25. Development Philosophy

This project should be designed before it is heavily coded.

The workflow should be:

    DESIGN
       ↓
    DISCUSS
       ↓
    CONFIRM LOGIC
       ↓
    IMPLEMENT
       ↓
    TEST
       ↓
    IMPROVE

Do not rush into adding strategy features before the architecture is clear.

---

# 26. Current Status

CURRENTLY:

    DESIGN ONLY

No final strategy has been selected.

No final RSI rules have been selected.

No final SMA rules have been selected.

No final TP/SL execution method has been selected.

No final multiple-entry system has been selected.

No final advanced bot structure has been selected.

The purpose of the next design discussions is to work through these items one at a time.

---

# 27. Next Design Discussion

Before coding, discuss:

1. Exact Simple Bot configuration
2. Exact chart requirements
3. Exact market-data requirements
4. RSI logic
5. SMA logic
6. Entry Model interface
7. TP behavior
8. SL behavior
9. Position handling
10. Start / Stop behavior
11. Multiple bot instances
12. How configurations are saved
13. How modules expose their settings
14. How modules can eventually be combined
15. Future advanced bot versions

The main goal is:

**Build a small clean foundation first.**

Then add complexity only when there is a real reason for it.