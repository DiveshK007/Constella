# StellrFlow

> Visual no-code workflow automation platform on Stellar. Drag-and-drop triggers, actions, and conditions to automate Stellar transactions and Telegram notifications — zero coding required.

## Screenshots

| Wallet Connected | Balance Display |
|:---:|:---:|
| ![Wallet Connected](screenshots/1-wallet-connected.png) | ![Balance Display](screenshots/2-balance-display.png) |

| Sending Transaction | Transaction Result |
|:---:|:---:|
| ![Sending Transaction](screenshots/3-send-transaction.png) | ![Transaction Result](screenshots/4-transaction-result.png) |

## What's Built

- **Telegram Bot** — Freighter wallet integration, XLM send/receive, balance checks
- **Anchor On/Off Ramp** — Fiat ↔ XLM conversion (SEP-24 demo)
- **AutoPay** — Recurring scheduled payments with interval parsing
- **Multisig** — Multi-signer approval flows for transactions
- **AI Chatbot** — OpenAI-powered Stellar knowledge assistant
- **React Frontend** — Visual workflow builder with drag-and-drop nodes
- **Soroban Contract** — `WorkflowRegistry` contract on testnet logs every workflow execution immutably

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js, React Flow, Zustand |
| Bot | Node.js, TypeScript, Telegram Bot API |
| Blockchain | Stellar SDK v14, Soroban (Rust) |
| AI | OpenAI GPT |
| Testing | Jest + ts-jest (52 tests) |

## Project Structure

```
StellrFlow/
├── frontend/                  ← React workflow builder UI
├── bots/telegram-stellar/     ← Telegram bot + REST API
│   ├── src/anchor/            ← Stellar service + anchor module
│   ├── src/sdk-chatbot.ts     ← AI chatbot
│   └── src/interval-parser.ts ← Cron interval utilities
└── contracts/
    ├── workflow_registry/     ← Soroban contract (Rust)
    └── stellrflow_telegram_bot/
```

## Quick Start

```bash
# Bot
cd bots/telegram-stellar
cp .env.example .env   # Add your TELEGRAM_BOT_TOKEN
npm install && npm run dev

# Frontend
cd frontend
npm install && npm run dev

# Tests
cd bots/telegram-stellar
npx jest --config jest.config.cjs
```

## License

MIT
