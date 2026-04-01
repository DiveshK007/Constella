/**
 * Shared application state — wallets, sessions, metrics, configs.
 * Imported by route modules and the bot initialization.
 */

import path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { Horizon, Keypair } from "@stellar/stellar-sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Configuration ──────────────────────────────────────────────────────────

export const STELLAR_NETWORK = process.env.STELLAR_NETWORK || "testnet";
export const HORIZON_URL =
  process.env.HORIZON_URL ||
  (STELLAR_NETWORK === "testnet"
    ? "https://horizon-testnet.stellar.org"
    : "https://horizon.stellar.org");
export const RPC_URL =
  process.env.STELLAR_RPC_URL ||
  (STELLAR_NETWORK === "testnet"
    ? "https://soroban-testnet.stellar.org"
    : "https://soroban-mainnet.stellar.org");
export const STELLAR_SECRET_KEY = process.env.STELLAR_SECRET_KEY || "";
export const ANCHOR_TREASURY_SECRET = process.env.ANCHOR_TREASURY_SECRET || "";

// ─── Horizon Client ─────────────────────────────────────────────────────────

export const horizon = new Horizon.Server(HORIZON_URL);

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface TelegramWallet {
  publicKey: string;
  secretKey: string;
  createdAt: Date;
}

export interface FreighterWallet {
  publicKey: string;
  network: string;
  connectedAt: Date;
}

export interface SessionData {
  features: string[];
  registeredAt: Date;
}

export interface AutoPaySchedule {
  scheduleId: string;
  chatId: string;
  destination: string;
  amount: number;
  interval: string;
  duration: number;
  createdAt: Date;
  nextPayment: Date;
  isActive: boolean;
}

export interface MultisigConfig {
  multisigId: string;
  chatId: string;
  threshold: number;
  signers: string[];
  timeout: number;
  createdAt: Date;
  isActive: boolean;
}

export interface PendingApproval {
  txId: string;
  multisigId: string;
  approvals: string[];
  createdAt: Date;
  expiresAt: Date;
}

// ─── In-Memory State ────────────────────────────────────────────────────────

export const userWallets = new Map<string, TelegramWallet>();
export const freighterWallets = new Map<string, FreighterWallet>();
export const activeSessions = new Map<string, SessionData>();
export const autoPaySchedules = new Map<string, AutoPaySchedule>();
export const multisigConfigs = new Map<string, MultisigConfig>();
export const pendingApprovals = new Map<string, PendingApproval>();
export const userChatIds = new Map<string, string>();

export let scheduleCounter = 1;
export let multisigCounter = 1;
export function nextScheduleId(): string {
  return `AP-${Date.now()}-${scheduleCounter++}`;
}
export function nextMultisigId(): string {
  return `MS-${Date.now()}-${multisigCounter++}`;
}

// ─── Metrics ────────────────────────────────────────────────────────────────

export const metrics = {
  startedAt: new Date(),
  totalRequests: 0,
  totalWalletsCreated: 0,
  totalTransactions: 0,
  totalCommands: 0,
  dailyActiveUsers: new Set<string>(),
  lastDayReset: new Date(),
  commandCounts: {} as Record<string, number>,
  requestLog: [] as { timestamp: string; method: string; path: string }[],
};

export function trackCommand(command: string, chatId: string) {
  metrics.totalCommands++;
  metrics.commandCounts[command] = (metrics.commandCounts[command] || 0) + 1;
  metrics.dailyActiveUsers.add(chatId);

  const now = new Date();
  if (now.getDate() !== metrics.lastDayReset.getDate()) {
    metrics.dailyActiveUsers.clear();
    metrics.lastDayReset = now;
  }
}

// ─── Wallet Persistence (JSON) ──────────────────────────────────────────────

interface WalletData {
  telegramWallets: Record<string, { publicKey: string; secretKey: string; createdAt: string }>;
  freighterWallets: Record<string, { publicKey: string; network: string; connectedAt: string }>;
}

const WALLETS_FILE = path.join(__dirname, "../data/wallets.json");
const dataDir = path.dirname(WALLETS_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export function loadWallets(): void {
  try {
    if (fs.existsSync(WALLETS_FILE)) {
      const data: WalletData = JSON.parse(fs.readFileSync(WALLETS_FILE, "utf-8"));
      for (const [chatId, wallet] of Object.entries(data.telegramWallets)) {
        userWallets.set(chatId, {
          publicKey: wallet.publicKey,
          secretKey: wallet.secretKey,
          createdAt: new Date(wallet.createdAt),
        });
      }
      for (const [chatId, wallet] of Object.entries(data.freighterWallets)) {
        freighterWallets.set(chatId, {
          publicKey: wallet.publicKey,
          network: wallet.network,
          connectedAt: new Date(wallet.connectedAt),
        });
      }
      console.log(
        `Loaded ${userWallets.size} Telegram wallets, ${freighterWallets.size} Freighter wallets from disk`
      );
    }
  } catch (err) {
    console.error("Failed to load wallets:", err);
  }
}

export function saveWallets(): void {
  try {
    const data: WalletData = {
      telegramWallets: Object.fromEntries(
        Array.from(userWallets.entries()).map(([k, v]) => [
          k,
          { publicKey: v.publicKey, secretKey: v.secretKey, createdAt: v.createdAt.toISOString() },
        ])
      ),
      freighterWallets: Object.fromEntries(
        Array.from(freighterWallets.entries()).map(([k, v]) => [
          k,
          { publicKey: v.publicKey, network: v.network, connectedAt: v.connectedAt.toISOString() },
        ])
      ),
    };
    fs.writeFileSync(WALLETS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Failed to save wallets:", err);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Get the active wallet for a chatId (Freighter takes priority) */
export function getWallet(chatId: string): TelegramWallet | FreighterWallet | undefined {
  return freighterWallets.get(chatId) || userWallets.get(chatId);
}

/** Check if an account exists on Horizon */
export async function accountExists(address: string): Promise<boolean> {
  try {
    await horizon.loadAccount(address);
    return true;
  } catch {
    return false;
  }
}
