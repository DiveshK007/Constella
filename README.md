# StellrFlow

<div align="center">
  <img src="./frontend/public/logo.png" alt="StellrFlow Logo" width="200"/>
  
  **Visual Workflow Automation for the Stellar Blockchain**
  
  [![Stellar](https://img.shields.io/badge/Stellar-Testnet-brightgreen)](https://stellar.org/)
  [![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
  [![Soroban](https://img.shields.io/badge/Soroban-Smart_Contracts-orange)](https://soroban.stellar.org/)
  [![Tests](https://img.shields.io/badge/Tests-52_Passing-success)](bots/telegram-stellar/jest.config.cjs)
  [![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)
  [![Live Demo](https://img.shields.io/badge/Live_Demo-Vercel-black)](https://stellr-flow-6rcr.vercel.app/)
  [![CI](https://github.com/DiveshK007/StellrFlow/actions/workflows/ci.yml/badge.svg)](https://github.com/DiveshK007/StellrFlow/actions/workflows/ci.yml)
  
  🌐 **[Live Demo → stellr-flow-6rcr.vercel.app](https://stellr-flow-6rcr.vercel.app/)**
</div>

---

## 📖 Table of Contents

- [About](#-about)
- [Screenshots](#-screenshots)
- [Demo Video](#-demo-video)
- [Why Stellar?](#-why-stellar)
- [Features](#-features)
- [How It Works](#-how-it-works)
- [Architecture](#-architecture-overview)
- [Tech Stack](#-tech-stack)
- [Bonus Features Implemented](#-bonus-features-implemented)
- [Getting Started](#-getting-started)
- [Smart Contract (Soroban)](#-smart-contract-soroban)
- [Test Coverage](#-test-coverage)
- [Project Structure](#-project-structure)
- [Security Considerations](#-security-considerations)
- [Future Roadmap](#-future-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌟 About

**StellrFlow** is a visual workflow automation platform built on the Stellar blockchain that empowers users to create sophisticated blockchain interactions without writing a single line of code. Through an intuitive drag-and-drop interface, users can connect triggers, actions, and conditions to automate Stellar transactions, monitor balances, send notifications, and integrate with Telegram — all powered by Soroban smart contracts on the backend.

> **What previously took days of development can now be accomplished in minutes with zero coding required.**

---

## 📸 Screenshots

| Wallet Connected | Balance Display |
|:---:|:---:|
| ![Wallet Connected](screenshots/1-wallet-connected.png) | ![Balance Display](screenshots/2-balance-display.png) |

| Sending Transaction | Transaction Result |
|:---:|:---:|
| ![Sending Transaction](screenshots/3-send-transaction.png) | ![Transaction Result](screenshots/4-transaction-result.png) |

| Workflow Builder |
|:---:|
| ![Workflow Builder](screenshots/5-workflow-builder.png) |

| 📱 Mobile Responsive |
|:---:|
| ![Mobile View](screenshots/7-mobile-view.png) |

---

## 🎥 Demo Video

> 🎬 [Watch the full demo walkthrough →](https://drive.google.com/file/d/1Bpd0j19UQHI7uDELugcD40GTXHxeFfjB/view?usp=drive_link)
> 
> Covers: Wallet connection • Balance check • XLM transfer • Soroban contract • Workflow builder

---

## 💡 Why Stellar?

Stellar is the ideal backbone for StellrFlow due to:

| Advantage | Detail |
|-----------|--------|
| ⚡ **Instant Settlement** | Transactions finalize in **3–5 seconds**, enabling real-time workflow execution |
| 💰 **Ultra-Low Fees** | Transaction fees are **0.00001 XLM** (~$0.000001), making micro-automation viable |
| 🔧 **Native Asset Support** | Custom assets are first-class citizens — no complex smart contracts needed for tokens |
| 🦀 **Soroban Smart Contracts** | Rust-based smart contracts for on-chain workflow execution logging |
| 🌐 **Testnet Available** | Full-featured testnet with Friendbot for free XLM, perfect for development |
| 🔗 **Horizon API** | Battle-tested REST API for real-time account monitoring and transaction submission |

---

## ✨ Features

### 🎨 Visual Workflow Builder
- **Drag-and-Drop Interface** — Node-based workflow creation using ReactFlow
- **Real-time Preview** — See your workflow structure as you build it
- **Node Categories** — Organized triggers, actions, conditions, and utilities
- **Connection Validation** — Smart validation prevents invalid connections
- **Save & Load** — Persist workflows to localStorage for later use

### 🔗 Stellar Blockchain Integration
- **Balance Monitoring** — Check XLM and token balances for any address
- **XLM Payments** — Send payments with configurable amounts and destinations
- **Account Monitoring** — Track account activities and trigger workflows
- **Freighter Wallet** — Native integration with Stellar's browser wallet
- **Horizon API** — Direct integration for real-time blockchain data

### 💬 Telegram Bot Integration

Users create their own Telegram bot via **@BotFather** and connect it to StellrFlow:

- **Wallet Management** — `/createwallet`, `/mywallet`, `/mybalance`, `/fundwallet`
- **XLM Transfers** — `/send <address> <amount>` with on-chain confirmation
- **Fiat On/Off Ramp** — `/addfunds` and `/withdraw` with SEP-24 anchor simulation
- **AutoPay** — Recurring scheduled payments with interval parsing
- **Multisig** — Multi-signer approval flows for high-value transactions
- **AI Chatbot** — OpenAI-powered Stellar knowledge assistant

### 🦀 Soroban Smart Contract
- **WorkflowRegistry** — On-chain execution logging for every workflow run
- **Immutable Audit Trail** — Every execution is recorded with timestamp, user, and status
- **Queryable History** — Retrieve execution logs by ID or get recent activity

---

## 📖 How It Works

### 1. 🔗 Connect Your Wallet
Click **"Connect Wallet"** to link your Freighter wallet. The app retrieves your public key and loads your account balances.

### 2. 🏗️ Build Your Workflow
Drag nodes from the sidebar onto the canvas — **Triggers** (Telegram message, schedule), **Actions** (send XLM, check balance), and **Conditions** (if balance > X).

### 3. ⚙️ Configure Nodes
Click any node to configure its parameters: destination address, amount, interval, chat ID, etc.

### 4. ▶️ Execute
Click **"Run Workflow"** — each node executes sequentially. Stellar transactions are signed via Freighter, and results appear visually on each node.

### 5. ✅ Verify On-Chain
Every execution is logged on the Stellar blockchain. Click **"View on Explorer"** to verify on [StellarExpert](https://stellar.expert).

---

## 🏛️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Next.js    │  │  ReactFlow   │  │  Zustand     │      │
│  │   UI/UX      │  │  Workflow    │  │  State Mgmt  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────────────┬────────────────────────────────┘
                             │ REST API
┌────────────────────────────▼────────────────────────────────┐
│                      Bot + API Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Telegram    │  │   Anchor     │  │   AutoPay    │      │
│  │  Bot API     │  │   On/Off     │  │   Scheduler  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────────────┬────────────────────────────────┘
                             │ Stellar SDK
┌────────────────────────────▼────────────────────────────────┐
│                      Blockchain Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Stellar    │  │   Horizon    │  │   Soroban    │      │
│  │   Testnet    │  │     API      │  │  Contracts   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|-----------|---------|
| [Next.js 15](https://nextjs.org/) | React framework with App Router |
| [React 19](https://react.dev/) | UI with concurrent features |
| [ReactFlow](https://reactflowdev.com/) | Node-based workflow builder |
| [Zustand](https://zustand-demo.pmnd.rs/) | Lightweight state management |
| [Tailwind CSS](https://tailwindcss.com/) | Utility-first styling |
| [shadcn/ui](https://ui.shadcn.com/) | High-quality UI components |
| [@dnd-kit](https://dndkit.com/) | Drag-and-drop toolkit |

### Backend (Telegram Bot)
| Technology | Purpose |
|-----------|---------|
| [Node.js](https://nodejs.org/) + TypeScript | Runtime + type safety |
| [Express.js](https://expressjs.com/) | REST API server (port 3003) |
| [Stellar SDK v14](https://stellar.github.io/js-stellar-sdk/) | Blockchain interaction |
| [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api) | Telegram Bot API |
| [OpenAI](https://openai.com/) | AI-powered chatbot |

### Smart Contracts
| Technology | Purpose |
|-----------|---------|
| [Soroban](https://soroban.stellar.org/) | Smart contract platform |
| Rust + soroban-sdk v22 | Contract development |

---

## 🏆 Bonus Features Implemented

| # | Feature | Status | Details |
|---|---------|--------|---------|
| 1 | Wallet Integration | ✅ | Freighter + Telegram bot wallets |
| 2 | XLM Transfers | ✅ | Send/receive with on-chain verification |
| 3 | Balance Monitoring | ✅ | Real-time balance for any address |
| 4 | Fiat On/Off Ramp | ✅ | SEP-24 anchor simulation (USD, EUR, INR, GBP) |
| 5 | Recurring Payments | ✅ | AutoPay with configurable intervals |
| 6 | Multi-signature | ✅ | Threshold-based approval flows |
| 7 | AI Chatbot | ✅ | OpenAI-powered Stellar assistant |
| 8 | Smart Contract | ✅ | Soroban WorkflowRegistry on testnet |
| 9 | Test Suite | ✅ | 52 Jest tests (100% pass rate) |
| 10 | Visual Workflow Builder | ✅ | Drag-and-drop with ReactFlow |
| 11 | Save/Load Workflows | ✅ | localStorage persistence |
| 12 | REST API | ✅ | 25+ endpoints for all features |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and npm/pnpm
- **Telegram Bot Token** (from [@BotFather](https://t.me/BotFather))
- **Freighter Wallet** ([Install](https://www.freighter.app/))
- **Stellar CLI** (optional, for contract deployment)

### Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/DiveshK007/StellrFlow.git
cd StellrFlow
```

#### 2. Setup Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

#### 3. Setup Telegram Bot

```bash
cd bots/telegram-stellar
npm install

# Create .env file
cp .env.example .env
# Edit .env with your TELEGRAM_BOT_TOKEN

npm run dev
# → Bot API on http://localhost:3003
```

#### 4. Get Your Telegram Chat ID

1. Start a chat with your bot on Telegram
2. Send `/register`
3. Bot replies with your chat ID
4. Use this chat ID in your workflows

### Quick Start Example

1. Open `http://localhost:3000`
2. Drag a **"Telegram Trigger"** node onto the canvas
3. Connect your Freighter wallet
4. Add a **"Check Balance"** node
5. Add a **"Send Telegram Message"** node
6. Connect them: Trigger → Balance → Message
7. Click **"Run Workflow"** and watch it execute!

---

## 🦀 Smart Contract (Soroban)

The **WorkflowRegistry** contract (`contracts/workflow_registry/`) logs every workflow execution immutably on the Stellar blockchain.

### ✅ Deployed on Stellar Testnet

| Item | Value |
|------|-------|
| **Contract ID** | `CBATLCK3E5SDUWTGS6SGB7NSDL6KF4EG7DTRI2KIX5TWNQVZSNUYIUMO` |
| **Deploy TX** | [`3f720889...`](https://stellar.expert/explorer/testnet/tx/3f720889cfb00778ae1b157e710c0be2c1037b1c014574ebcadf675daefcf777) |
| **Sample Invoke TX** | [`b97ff370...`](https://stellar.expert/explorer/testnet/tx/b97ff3707796a533a022f52f56822627faf56a448e4d41c870187e09f0ab991a) |
| **View on Explorer** | [StellarExpert](https://stellar.expert/explorer/testnet/contract/CBATLCK3E5SDUWTGS6SGB7NSDL6KF4EG7DTRI2KIX5TWNQVZSNUYIUMO) • [Stellar Lab](https://lab.stellar.org/r/testnet/contract/CBATLCK3E5SDUWTGS6SGB7NSDL6KF4EG7DTRI2KIX5TWNQVZSNUYIUMO) |

### Contract Functions

```rust
// Log a workflow execution
log_execution(env, executor, workflow_id, node_count, success) → execution_id

// Query executions
get_execution(env, execution_id) → WorkflowExecution
get_count(env) → u64
get_recent(env, limit) → Vec<WorkflowExecution>
```

### Deploy to Testnet

```bash
cd contracts/workflow_registry
stellar contract build
stellar contract deploy \
  --wasm target/wasm32v1-none/release/workflow_registry.wasm \
  --source alice \
  --network testnet
```

### ⚠️ Error Handling (3 types documented)

| # | Error Type | Where | How It's Handled |
|---|-----------|-------|-----------------|
| 1 | **Wallet not found** | `executeWalletIntegration()` | Detects when Freighter is not installed, prompts user to install |
| 2 | **Transaction rejected** | `sendXLM()` | Catches user rejection during wallet signing, shows error message |
| 3 | **Insufficient balance** | `executeTelegramSend()` | Validates balance < required XLM before tx, returns descriptive error |

---

## 🧪 Test Coverage

**52 tests** across 2 test suites — all passing ✅

```
PASS  src/anchor/stellarService.test.ts (15 tests)
  ✓ getBalance — funded account, unfunded account, error handling
  ✓ sendXLM — existing destination, new account (createAccount)
  ✓ fundWithFriendbot — success, failure cases
  ✓ getTransactionLog — parsing, empty results
  ✓ getNetworkName — testnet, mainnet, custom

PASS  src/interval-parser.test.ts (37 tests)
  ✓ All time units (seconds, minutes, hours, days, weeks)
  ✓ Edge cases, validation, formatting
```

Run tests:
```bash
cd bots/telegram-stellar
npx jest --config jest.config.cjs
```

![Test Output — 52 Passing](screenshots/6-test-output.png)

---

## 📁 Project Structure

```
StellrFlow/
├── frontend/                      # Next.js workflow builder UI
│   ├── app/                       # App router pages
│   │   ├── page.tsx               # Main workflow builder
│   │   ├── connect-wallet/        # Wallet connection page
│   │   └── send-transaction/      # Transaction demo page
│   ├── components/workflow/       # ReactFlow components
│   │   ├── workflow-builder.tsx   # Main canvas
│   │   ├── node-types-sidebar.tsx # Draggable node palette
│   │   └── properties-panel.tsx   # Node configuration
│   └── lib/stores/
│       └── workflow-store.ts      # Zustand state (save/load)
│
├── bots/telegram-stellar/         # Telegram bot + REST API
│   ├── src/
│   │   ├── telegram-bot.ts        # Bot commands + Express API
│   │   ├── anchor/                # Stellar SDK + anchor module
│   │   │   ├── stellarService.ts  # Balance, send, fund
│   │   │   ├── mockAnchor.ts      # SEP-24 simulation
│   │   │   ├── onramp.ts          # Fiat → XLM
│   │   │   └── offramp.ts         # XLM → fiat
│   │   ├── sdk-chatbot.ts         # OpenAI chatbot
│   │   └── interval-parser.ts     # Cron utilities
│   └── screenshots/               # Bot demo screenshots
│
├── contracts/
│   ├── workflow_registry/         # Soroban contract (Rust)
│   │   └── src/lib.rs             # WorkflowRegistry
│   └── stellrflow_telegram_bot/   # Additional contract
│
└── screenshots/                   # Root demo screenshots
```

---

## 🔐 Security Considerations

- **No private keys stored** — The application never requests or stores private keys
- **Wallet signing** — All Stellar transactions are signed by the user's Freighter wallet, not the application
- **Testnet only** — Currently configured for Stellar Testnet for safe development
- **Environment variables** — Sensitive tokens (Telegram, OpenAI) stored in `.env`, never committed
- **Transaction verification** — Always verify transactions on [StellarExpert](https://stellar.expert)
- **Minimum balance** — Stellar accounts require 1 XLM reserve; the bot keeps 1.5 XLM buffer

---

## 🔮 Future Roadmap

- [x] Visual workflow builder with drag-and-drop
- [x] Telegram bot with wallet management
- [x] Fiat on/off ramp (anchor simulation)
- [x] AutoPay recurring payments
- [x] Multisig transaction flows
- [x] Soroban smart contract deployment
- [x] 52-test Jest suite
- [ ] Discord / WhatsApp bot integration
- [ ] Token swap automation on Stellar DEX
- [ ] Liquidity pool management
- [ ] Cross-chain bridge integration (Ethereum, BSC)
- [ ] Template marketplace for sharing workflows
- [ ] Mobile progressive web app
- [ ] Mainnet deployment

---

## 🤝 Contributing

We welcome contributions! Whether it's bug fixes, new features, or documentation improvements:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write meaningful commit messages
- Add tests for new features
- Ensure code passes linting (`npm run lint`)

---

## 🔒 Security

Full security checklist: **[SECURITY.md](SECURITY.md)**

Key measures:
- ✅ No private keys in source code — all secrets in `.env`
- ✅ Freighter wallet signs locally — keys never leave the extension
- ✅ `require_auth()` on all Soroban state-changing functions
- ✅ Input validation on all API endpoints
- ✅ HTTPS enforced via Vercel deployment

---

## 📊 Metrics & Monitoring

**Live Dashboard:** [stellr-flow-6rcr.vercel.app/metrics](https://stellr-flow-6rcr.vercel.app/metrics)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/metrics` | Full metrics JSON (users, DAU, requests, commands) |
| `GET /api/telegram/health` | Health check with uptime |
| `GET /api/users/addresses` | List all wallet addresses |

---

## ⚡ Advanced Features

### 1. Fee Sponsorship (Gasless Transactions)
Users can submit transactions with fees paid by StellrFlow via fee bump:
```
POST /api/transaction/fee-bump
Body: { "innerTxXdr": "<base64 XDR>" }
```
This wraps the user's transaction in a fee bump, allowing gasless UX.

### 2. Multi-Signature Approval
Threshold-based multi-party approval flows:
```
POST /api/multisig/create — Create multisig config
GET  /api/multisig/:chatId — View configs
```

### 3. SEP-24 Anchor Integration (Fiat On/Off Ramp)
Simulated anchor for USD, EUR, INR, GBP:
```
POST /api/anchor/deposit  — Fiat → XLM
POST /api/anchor/withdraw — XLM → Fiat
GET  /api/anchor/rates     — Exchange rates
```

---

## 📈 Data Indexing

Wallet and transaction data is indexed via the bot API:

| Endpoint | Data |
|----------|------|
| `GET /api/users/addresses` | All wallet public keys with timestamps |
| `GET /api/metrics` | Aggregated user/transaction/command metrics |
| `GET /api/anchor/history/:chatId` | Anchor deposit/withdrawal history |
| `GET /api/autopay/:chatId` | Scheduled payment data |

---

## 🗺️ Improvement Roadmap

Based on user feedback collected via Google Form:

| Phase | Improvement | Status |
|-------|------------|--------|
| v1.1 | Add wallet connect button to navbar | ✅ Done |
| v1.1 | Auto-redirect after wallet connection | ✅ Done |
| v1.2 | Metrics dashboard with real-time data | ✅ Done |
| v1.2 | Fee sponsorship for gasless transactions | ✅ Done |
| v1.3 | Security checklist + monitoring endpoints | ✅ Done |
| v2.0 | Persistent database (PostgreSQL) | 🔜 Planned |
| v2.0 | JWT authentication for API | 🔜 Planned |
| v2.1 | Mainnet deployment | 🔜 Planned |
| v2.1 | Mobile app (React Native) | 🔜 Planned |

---

## 📋 User Feedback

**Google Form:** [Submit Feedback](https://forms.gle/gEFaZV9n891Mwrg7A)

Collecting: Name, Email, Wallet Address, Product Rating (1-5)

**Responses Export:** *(Excel sheet will be linked here after collection)*

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built for the **Stellar Buildathon** by [Rise In](https://www.risein.com/)
- Powered by [Stellar](https://stellar.org/) and [Soroban](https://soroban.stellar.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Workflow engine by [ReactFlow](https://reactflowdev.com/)

---

<div align="center">
  <strong>Built with ❤️ for the Stellar community</strong>
  <br/>
  <sub>Making blockchain automation accessible to everyone</sub>
</div>
