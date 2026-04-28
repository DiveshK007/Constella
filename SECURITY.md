# Security Checklist — StellrFlow

> **Scope:** This document covers the security posture of StellrFlow as a Stellar hackathon
> project running exclusively on **testnet**. All items are assessed against the current
> codebase. Items marked ⚠️ are acknowledged limitations with a stated production migration
> path.

---

## 1. Smart Contract Security

### WorkflowRegistry (`contracts/workflow_registry/src/lib.rs`)

| # | Control | Status | Notes |
|---|---------|--------|-------|
| 1.1 | Caller authorization on state-changing functions | ✅ | `executor.require_auth()` is called at the top of `log_execution` before any storage write. Soroban rejects the invocation if the signature is absent or invalid. |
| 1.2 | No reentrancy vulnerabilities | ✅ | Soroban's WASM execution model is single-threaded and does not support recursive cross-contract calls mid-execution. There is no callback pattern and no Ether-style value transfer, so reentrancy is structurally impossible. |
| 1.3 | Bounded query results prevent DoS | ✅ | `get_recent()` clamps the caller-supplied `limit` with `limit.min(10)` before iterating storage. A caller cannot force unbounded reads. |
| 1.4 | Integer overflow protection | ✅ | `execution_id` is `u64` incremented by 1 per call. At one call per second it would take ~585 billion years to overflow. Rust's default overflow checks panic in debug builds and wrap in release — neither causes loss of funds here. |
| 1.5 | Immutable audit trail | ✅ | Each execution record is written to `persistent()` storage keyed by its ID. Existing records are never overwritten; only the counter advances. |
| 1.6 | No `unsafe` code | ✅ | `#![no_std]` is declared; the crate contains no `unsafe` blocks. |
| 1.7 | Formal audit | ⚠️ | No third-party audit has been performed. Recommended before any mainnet deployment. |

### StellrflowTelegramBot (`contracts/stellrflow_telegram_bot/src/lib.rs`)

| # | Control | Status | Notes |
|---|---------|--------|-------|
| 1.8 | Authorization on `register_notification` | ⚠️ | This auxiliary counter contract does not call `require_auth()`. Any caller can increment the notification or payment counter. Acceptable for a testnet audit-trail counter with no funds at stake; must be gated before mainnet. |
| 1.9 | No funds held in contract | ✅ | Neither contract holds XLM or tokens; they are pure counters. Unauthorized calls can distort metrics but cannot extract funds. |

---

## 2. Bot Security (`bots/telegram-stellar/src/telegram-bot.ts`)

### 2.1 Secret Key Storage

| # | Control | Status | Notes |
|---|---------|--------|-------|
| 2.1.1 | Bot fee-sponsor key loaded from environment | ✅ | `STELLAR_SECRET_KEY` and `ANCHOR_TREASURY_SECRET` are read from `process.env` at startup. They are never written to disk or included in source. |
| 2.1.2 | Telegram wallet keys stored in plaintext JSON | ⚠️ | User-generated Stellar keypairs are persisted to `data/wallets.json` as plaintext `secretKey` fields. This is acceptable for a testnet project where wallets are funded only via Friendbot (no real value). **Production requirement:** encrypt with AES-256-GCM using a KMS-managed key before storing, or migrate to a secrets-capable database (PostgreSQL + pgcrypto). |
| 2.1.3 | Secret keys never transmitted to the frontend | ✅ | The bot API exposes only public keys and balances. Secret keys remain server-side only. |
| 2.1.4 | `.env` file is gitignored | ✅ | `.env` is in `.gitignore`. The repository contains only `.env.example` with placeholder values. |

### 2.2 Environment Variables

| # | Variable | Status | Notes |
|---|----------|--------|-------|
| 2.2.1 | `TELEGRAM_BOT_TOKEN` | ✅ | Stored in `.env`, never hardcoded. |
| 2.2.2 | `STELLAR_SECRET_KEY` | ✅ | Fee-sponsor key loaded from environment only. Absent key causes the fee-bump endpoint to return 500 rather than silently proceeding. |
| 2.2.3 | `ANCHOR_TREASURY_SECRET` | ✅ | Loaded from environment. Used only for anchor off-ramp operations. |
| 2.2.4 | `OPENAI_API_KEY` | ✅ | Loaded from environment. Never logged or returned in API responses. |

### 2.3 Rate Limiting

| # | Control | Status | Notes |
|---|---------|--------|-------|
| 2.3.1 | Express-level rate limiting | ⚠️ | No rate-limiting middleware (`express-rate-limit` or similar) is currently configured. The API is protected only by Telegram's own message throttling on bot commands. **Production fix:** add `express-rate-limit` with a per-IP limit (e.g., 60 req/min) and stricter limits on `/api/transaction/*` endpoints. |
| 2.3.2 | Friendbot call rate limiting | ⚠️ | `/fundwallet` calls `https://friendbot.stellar.org` directly with no per-user cooldown. A user could spam the endpoint. **Fix:** record last-funded timestamp per wallet and enforce a minimum interval (e.g., 5 minutes). |
| 2.3.3 | Horizon API rate limit awareness | ✅ | The bot does not batch-poll Horizon; it issues per-command requests only, staying well within Horizon's 3,600 req/hour anonymous limit. |

### 2.4 Input Validation

| # | Control | Status | Notes |
|---|---------|--------|-------|
| 2.4.1 | Amount fields validated as positive numbers | ✅ | Every command that accepts an `<amount>` runs `parseFloat()` followed by `isNaN(amount) \|\| amount <= 0` before any downstream call. |
| 2.4.2 | Minimum send amount enforced | ✅ | `/send` rejects amounts below 1 XLM to prevent dust spam. |
| 2.4.3 | Destination address trimmed | ✅ | Address fields are `.trim()`-ed before use. Invalid Stellar addresses are rejected by the SDK at transaction-build time. |
| 2.4.4 | Command regex matching | ✅ | Bot commands are matched via `onText` regex patterns; unrecognized input falls through to the AI chatbot or is ignored. |
| 2.4.5 | No SQL injection surface | ✅ | No SQL database is used. Storage is file-based JSON and Soroban persistent storage. |

### 2.5 API Security

| # | Control | Status | Notes |
|---|---------|--------|-------|
| 2.5.1 | CORS configuration | ⚠️ | `cors()` is called with no options, which allows all origins. **Production fix:** restrict to the Vercel frontend domain via `cors({ origin: 'https://your-app.vercel.app' })`. |
| 2.5.2 | No Helmet.js HTTP headers | ⚠️ | Security headers (CSP, X-Frame-Options, HSTS, etc.) are not set on the Express server. **Fix:** add `helmet()` as the first middleware. |
| 2.5.3 | Error responses sanitized | ✅ | Catch blocks return structured JSON errors without stack traces or internal file paths. |
| 2.5.4 | Horizon result codes surfaced safely | ✅ | `extras.result_codes` from failed transactions are serialized with `JSON.stringify` and returned as a string, not executed or interpolated into shell commands. |

---

## 3. Frontend Security (`frontend/`)

| # | Control | Status | Notes |
|---|---------|--------|-------|
| 3.1 | No private keys in frontend code | ✅ | The Next.js codebase contains zero Stellar secret keys. All wallet operations either use the Freighter browser extension or call the bot API (which holds keys server-side). |
| 3.2 | Freighter signing — keys never leave the wallet | ✅ | The connect-wallet flow calls `requestAccess()` and then relies on Freighter to sign. The frontend receives only the signed transaction envelope or a public key — never the secret. |
| 3.3 | XSS prevention | ✅ | Next.js escapes all JSX-interpolated values by default. No `dangerouslySetInnerHTML` is used anywhere in the component tree. |
| 3.4 | HTTPS enforced | ✅ | Vercel enforces HTTPS on all deployments. HTTP requests are redirected to HTTPS automatically. |
| 3.5 | No `NEXT_PUBLIC_` exposure of secrets | ✅ | Only `NEXT_PUBLIC_STELLAR_BOT_URL` (the bot's local/deployed URL) is exposed to the client. No API keys or secrets are prefixed `NEXT_PUBLIC_`. |
| 3.6 | Dependency supply-chain | ✅ | All packages are pinned to exact or caret versions in `package.json`. `npm audit` should be run before any production release. |
| 3.7 | localStorage key storage | ✅ | The frontend stores only workflow graph state and execution counts in `localStorage` — no private keys or sensitive credentials. |

---

## 4. Operational Security

| # | Control | Status | Notes |
|---|---------|--------|-------|
| 4.1 | Testnet isolation — no mainnet risk | ✅ | `STELLAR_NETWORK=testnet` is set in the bot environment. The Horizon URL resolves to `https://horizon-testnet.stellar.org`. All wallets are funded via Friendbot with zero real-world value. |
| 4.2 | Bot token in environment | ✅ | `TELEGRAM_BOT_TOKEN` is loaded from `.env`. Rotation is straightforward via BotFather without code changes. |
| 4.3 | OpenAI key in environment | ✅ | `OPENAI_API_KEY` is never logged, returned in responses, or committed to version control. |
| 4.4 | Wallet data directory excluded from git | ✅ | `bots/telegram-stellar/data/` (where `wallets.json` is written at runtime) is listed in `.gitignore`. |
| 4.5 | Request logging | ✅ | Every Express request is logged with timestamp, method, and path, enabling post-incident review. |
| 4.6 | Health and metrics endpoints | ✅ | `/api/telegram/health` and `/api/metrics` allow uptime and usage monitoring without exposing sensitive data. |
| 4.7 | CI/CD pipeline | ✅ | GitHub Actions runs the test suite on every push, preventing regressions from reaching the deployed branch. |

---

## 5. Known Limitations (Testnet — Accepted Risk)

The following items are acknowledged weaknesses that are **acceptable for a testnet hackathon** but **must be resolved before any production or mainnet deployment**.

| # | Limitation | Risk Level (Testnet) | Production Remediation |
|---|------------|----------------------|------------------------|
| 5.1 | Telegram wallet secret keys stored in plaintext JSON (`data/wallets.json`) | Low — wallets contain no real funds | Encrypt with AES-256-GCM; use a KMS or HSM-backed key. Migrate storage to PostgreSQL + pgcrypto. |
| 5.2 | No rate limiting on Express API endpoints | Low — bot is not publicly advertised | Add `express-rate-limit`: 60 req/min globally, 5 req/min on transaction endpoints. |
| 5.3 | No per-user cooldown on Friendbot calls (`/fundwallet`) | Low — Friendbot itself rate-limits per address | Track last-funded timestamp per wallet; enforce a 5-minute minimum between calls. |
| 5.4 | CORS allows all origins (`cors()` with no options) | Low — API is not publicly documented | Restrict to the exact Vercel deployment domain. |
| 5.5 | No HTTP security headers (Helmet.js missing on Express) | Low — not internet-facing in hackathon context | Add `helmet()` as first Express middleware. |
| 5.6 | `StellrflowTelegramBot` contract lacks `require_auth()` on counter functions | Low — counters carry no funds | Gate with `env.current_contract_address().require_auth()` or a stored admin address. |
| 5.7 | No third-party smart contract audit | Low — testnet only | Commission an audit (e.g., OtterSec, Halborn) before mainnet deployment. |
| 5.8 | In-memory metrics reset on bot restart | Low — cosmetic only | Persist metrics to a database alongside wallet storage. |

---

## Production Readiness Checklist

Before launching on mainnet, all items below must be completed:

- [ ] Encrypt `wallets.json` with AES-256-GCM (or migrate to encrypted DB)
- [ ] Add `express-rate-limit` middleware with per-route limits
- [ ] Add `helmet()` to the Express app
- [ ] Restrict CORS to the production frontend domain
- [ ] Add `require_auth()` to `StellrflowTelegramBot` contract functions
- [ ] Commission a smart contract security audit
- [ ] Replace Friendbot funding with a treasury-controlled faucet with cooldowns
- [ ] Add JWT or HMAC-based authentication on bot API endpoints
- [ ] Migrate treasury wallet signing to a hardware wallet or cloud KMS
- [ ] Enable Sentry (or equivalent) for error tracking in production
- [ ] Run `npm audit --production` and resolve all high/critical advisories
- [ ] Set `STELLAR_NETWORK=mainnet` and verify all Horizon URLs update accordingly
- [ ] Verify all `NEXT_PUBLIC_` env vars contain no sensitive values

---

*Last reviewed: 2026-04-28 — reflects codebase at commit `e06b07a`.*
