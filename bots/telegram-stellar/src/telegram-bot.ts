/**
 * StellrFlow Telegram Bot - Stellar Integration
 *
 * Adapted from fluid-labs/core/bots/telegram (AO) for Stellar.
 * Uses @stellar/stellar-sdk for balance checks and payments.
 *
 * @see https://stellar.github.io/js-stellar-sdk/
 * @see https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup
 */

// Start the Express server
import TelegramBot from "node-telegram-bot-api";
import express from "express";
import cors from "cors";
import {
  generalLimiter,
  corsOptions,
} from "./middleware/security.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Networks, Keypair, TransactionBuilder, Operation, Asset, BASE_FEE } from "@stellar/stellar-sdk";

// Shared state and route modules
import {
  STELLAR_NETWORK as _NET,
  HORIZON_URL,
  STELLAR_SECRET_KEY as _SECRET,
  ANCHOR_TREASURY_SECRET as _ANCHOR_SECRET,
  horizon,
  userWallets,
  freighterWallets,
  activeSessions,
  userChatIds,
  metrics,
  trackCommand,
  loadWallets,
  saveWallets,
  getWallet,
} from "./state.js";
import { mountRoutes } from "./routes/index.js";

// Anchor module — on/off ramp + Stellar helpers
import {
  quickDeposit,
  quickWithdrawal,
  getDepositEstimate,
  getWithdrawalEstimate,
  getDeposit,
  getWithdrawal,
  getUserDeposits,
  getUserWithdrawals,
  getExchangeRate,
  getSupportedCurrencies,
  getLogForAddress,
} from "./anchor/index.js";
import { answerStellarQuestion } from "./sdk-chatbot.js";
import { logExecutionWithSecret } from "./contractLogger.js";
import QRCode from "qrcode";
import {
  parseIntervalFormat,
  formatIntervalForDisplay,
} from "./interval-parser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

// Configuration (state re-exports: STELLAR_NETWORK, HORIZON_URL, STELLAR_SECRET_KEY, ANCHOR_TREASURY_SECRET)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const PORT = parseInt(process.env.PORT || "3003", 10);
const STELLAR_NETWORK = _NET;
const STELLAR_SECRET_KEY = _SECRET;
const ANCHOR_TREASURY_SECRET = _ANCHOR_SECRET;

if (!TELEGRAM_BOT_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN is not defined in .env");
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Load persisted wallets from disk via shared state module
loadWallets();

// Escape HTML special chars in dynamic content for parse_mode: "HTML"
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Format XLM balance: "10000.0000000" → "10,000.00"
const fmtXLM = (bal: string) => {
  const n = parseFloat(bal);
  return isNaN(n) ? bal : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Pending send confirmations: chatId → { destAddress, amount, memo }
const pendingSends = new Map<string, { destAddress: string; amount: number; memo?: string }>();

/**
 * Fire-and-forget: record a completed run on the WorkflowRegistry contract,
 * signed by the user's in-bot wallet, then notify them of the on-chain record.
 * Non-blocking — never awaited by callers and never throws into them; a failed
 * contract call is only logged to the console, the triggering action still
 * succeeds.
 */
function logRunOnChain(chatId: string, secret: string, workflowId: string, nodeCount: number): void {
  logExecutionWithSecret({ secret, workflowId, nodeCount, success: true })
    .then((r) => {
      if (r.success && r.hash) {
        bot
          .sendMessage(
            chatId,
            `⛓️ <b>Logged on-chain</b>\n\n` +
              `This run was recorded in the WorkflowRegistry contract.\n\n` +
              `🔗 <a href="https://stellar.expert/explorer/${STELLAR_NETWORK}/tx/${esc(r.hash)}">View record</a>`,
            { parse_mode: "HTML", disable_web_page_preview: true }
          )
          .catch(() => {});
      } else {
        console.error(`[contract-log] on-chain log failed for ${chatId}:`, r.error);
      }
    })
    .catch((e) => console.error("[contract-log] unexpected error:", e));
}

// Active balance watchers: chatId → intervalId
const balanceWatchers = new Map<string, ReturnType<typeof setInterval>>();

// Address book: chatId → Map<name, address>
const addressBook = new Map<string, Map<string, string>>();
const getContacts = (chatId: string) => {
  if (!addressBook.has(chatId)) addressBook.set(chatId, new Map());
  return addressBook.get(chatId)!;
};

function initBot() {
  console.log("Initializing StellrFlow Telegram Bot (Stellar)...");

  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id.toString();
    const username = msg.from?.username || msg.from?.first_name || "there";

    if (msg.from?.id) {
      userChatIds.set(msg.from.id.toString(), chatId);
    }

    const hasTelegramWallet = userWallets.has(chatId);
    const hasFreighterWallet = freighterWallets.has(chatId);

    if (hasTelegramWallet || hasFreighterWallet) {
      // Returning user — show quick-action keyboard
      const wallet = (freighterWallets.get(chatId) || userWallets.get(chatId))!;
      bot.sendMessage(
        chatId,
        `👋 Welcome back, <b>${esc(username)}</b>!\n\n` +
        `<b>Wallet:</b> <code>${esc(wallet.publicKey.slice(0, 8))}...${esc(wallet.publicKey.slice(-8))}</code>\n\n` +
        `What would you like to do?`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "💰 My Balance", callback_data: "check_balance" }, { text: "📤 Send XLM", callback_data: "send_help" }],
              [{ text: "📋 Tx History", callback_data: "tx_history" }, { text: "❓ Help", callback_data: "show_help" }],
            ],
          },
        }
      );
    } else {
      // New user — guided onboarding
      bot.sendMessage(
        chatId,
        `👋 Hello, <b>${esc(username)}</b>! Welcome to <b>StellrFlow Bot</b>.\n\n` +
        `I can help you send XLM, check balances, and automate Stellar payments.\n\n` +
        `<b>Step 1 — Connect a wallet to get started:</b>`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🆕 Create In-Bot Wallet", callback_data: "onboard_create" }],
              [{ text: "🦊 I have Freighter", callback_data: "onboard_freighter" }],
              [{ text: "❓ What's the difference?", callback_data: "onboard_explain" }],
            ],
          },
        }
      );
    }
  });

  // Handle regular messages for Stellar Chatbot
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id.toString();
    const text = msg.text;

    // Check if session has 'chatbot' feature enabled
    const session = activeSessions.get(chatId);
    if (!session || !session.features.includes("chatbot")) {
      return;
    }

    // Ignore commands
    if (!text || text.startsWith("/")) {
      return;
    }

    // Answer question using Stellar SDK knowledge base
    await bot.sendChatAction(chatId, "typing");
    const answer = await answerStellarQuestion(text);

    await bot.sendMessage(chatId, esc(answer), {
      parse_mode: "HTML",
      reply_to_message_id: msg.message_id
    });
  });

  bot.onText(/\/register/, (msg) => {
    const chatId = msg.chat.id.toString();
    const username = msg.from?.username || "User";

    if (msg.from?.id) {
      userChatIds.set(msg.from.id.toString(), chatId);
      bot.sendMessage(
        chatId,
        `Registered! ${esc(username)}, your chat ID is: <code>${esc(chatId)}</code>`,
        { parse_mode: "HTML" }
      );
    }
  });

  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id.toString();
    const hasTelegramWallet = userWallets.has(chatId);
    const hasFreighterWallet = freighterWallets.has(chatId);
    const hasAnyWallet = hasTelegramWallet || hasFreighterWallet;

    let helpText = "<b>StellrFlow Bot Commands</b>\n\n" +
      "<b>General:</b>\n" +
      "/start - Start the bot\n" +
      "/register - Get your chat ID\n" +
      "/status - Check your wallet status\n" +
      "/balance <address> - Check any Stellar address\n" +
      "/rates - View exchange rates\n" +
      "/help - Show this message\n";

    if (hasAnyWallet) {
      const walletType = hasFreighterWallet ? "🦊 Freighter" : "📱 Telegram";
      const wallet = hasFreighterWallet ? freighterWallets.get(chatId)! : userWallets.get(chatId)!;

      helpText += `\n<b>${walletType} Wallet Commands:</b>\n` +
        "/mybalance - Check your wallet balance\n" +
        "/mywallet - Show your wallet address\n" +
        "/send <address> <amount> - Send XLM\n" +
        "/disconnect - Disconnect your wallet\n";

      // Only show fundwallet for Telegram wallets
      if (hasTelegramWallet && !hasFreighterWallet) {
        helpText += "/fundwallet - Get testnet XLM\n";
      }

      helpText += `\n<b>💰 On/Off Ramp (Anchor):</b>\n` +
        "/addfunds <amount> [currency] - Deposit fiat → XLM\n" +
        "/withdraw <xlm> [currency] - Withdraw XLM → fiat\n" +
        "/rates - View demo exchange rates\n" +
        "/txhistory - Your deposit/withdrawal history\n" +
        "/depositstatus <id> - Check deposit status\n" +
        "/withdrawstatus <id> - Check withdrawal status\n";

      helpText += `\n_Connected: ${wallet.publicKey.slice(0, 8)}...${wallet.publicKey.slice(-8)}_\n`;
    } else {
      helpText += "\n<b>Wallet Options:</b>\n" +
        "• Connect Freighter via StellrFlow workflow\n" +
        "• Or connect Telegram wallet via workflow\n";
    }

    bot.sendMessage(chatId, helpText, { parse_mode: "HTML" });
  });

  // Status command - shows which wallet is connected
  bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id.toString();
    const telegramWallet = userWallets.get(chatId);
    const freighterWallet = freighterWallets.get(chatId);
    const session = activeSessions.get(chatId);

    let statusText = "<b>📊 Your StellrFlow Status</b>\n\n";

    if (freighterWallet) {
      statusText += "<b>🦊 Wallet Type:</b> Freighter (Browser)\n" +
        `<b>Address:</b> <code>${esc(freighterWallet.publicKey.slice(0, 8))}...${esc(freighterWallet.publicKey.slice(-8))}</code>\n` +
        `<b>Network:</b> ${esc(freighterWallet.network)}\n\n` +
        "<i>Use /send to sign transactions via Freighter</i>\n";
    } else if (telegramWallet) {
      statusText += "<b>📱 Wallet Type:</b> Telegram (In-Bot)\n" +
        `<b>Address:</b> <code>${esc(telegramWallet.publicKey.slice(0, 8))}...${esc(telegramWallet.publicKey.slice(-8))}</code>\n\n` +
        "<i>Use /send to send XLM directly</i>\n";
    } else {
      statusText += "<b>Wallet:</b> Not connected\n\n" +
        "Connect a wallet via StellrFlow workflow:\n" +
        "• Freighter - Use your browser wallet\n" +
        "• Telegram - Create an in-bot wallet\n";
    }

    if (session) {
      statusText += `\n<b>Session:</b> Active\n` +
        `<b>Features:</b> ${session.features.join(", ") || "None"}\n`;
    }

    bot.sendMessage(chatId, statusText, { parse_mode: "HTML" });
  });

  // === UNIFIED WALLET COMMANDS ===
  // These work for both Freighter and Telegram wallets

  // Check wallet balance (works for both wallet types)
  bot.onText(/\/mybalance/, async (msg) => {
    const chatId = msg.chat.id.toString();
    const telegramWallet = userWallets.get(chatId);
    const freighterWallet = freighterWallets.get(chatId);

    // Determine which wallet to use (Freighter takes priority if both exist)
    const wallet = freighterWallet || telegramWallet;
    const walletType = freighterWallet ? "🦊 Freighter" : "📱 Telegram";

    if (!wallet) {
      bot.sendMessage(
        chatId,
        "❌ No wallet connected.\n\n" +
        "Connect a wallet via StellrFlow workflow to use this command.",
        { parse_mode: "HTML" }
      );
      return;
    }

    try {
      const account = await horizon.loadAccount(wallet.publicKey);
      const xlmBalance = account.balances.find((b) => b.asset_type === "native");
      const balance = xlmBalance && "balance" in xlmBalance ? xlmBalance.balance : "0";

      const otherBalances = account.balances
        .filter((b) => b.asset_type !== "native" && "asset_code" in b)
        .map((b: any) => `• ${b.balance} ${b.asset_code}`)
        .join("\n");

      const network = freighterWallet?.network || STELLAR_NETWORK;

      bot.sendMessage(
        chatId,
        `${walletType} <b>Wallet Balance</b>\n\n` +
        `<b>XLM:</b> ${fmtXLM(balance)}\n` +
        (otherBalances ? `\n<b>Other Assets:</b>\n${esc(otherBalances)}\n` : "") +
        `\n<b>Address:</b> <code>${esc(wallet.publicKey.slice(0, 8))}...${esc(wallet.publicKey.slice(-8))}</code>\n` +
        `Network: ${esc(network)}`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[
              { text: "📤 Send XLM", callback_data: "send_help" },
              { text: "🔄 Refresh", callback_data: "refresh_balance" },
            ]],
          },
        }
      );
    } catch (err: any) {
      if (err?.response?.status === 404) {
        bot.sendMessage(
          chatId,
          `${walletType} <b>Wallet Balance</b>\n\n` +
          `<b>XLM:</b> 0.00 (account not funded)\n\n` +
          (telegramWallet && !freighterWallet
            ? `💡 Use /fundwallet to get free testnet XLM.`
            : `💡 Fund your account to activate it on Stellar.`),
          { parse_mode: "HTML" }
        );
      } else {
        bot.sendMessage(chatId, `❌ Error: ${err.message || "Try again later"}`);
      }
    }
  });

  // Show wallet address (works for both wallet types)
  bot.onText(/\/mywallet/, (msg) => {
    const chatId = msg.chat.id.toString();
    const telegramWallet = userWallets.get(chatId);
    const freighterWallet = freighterWallets.get(chatId);

    const wallet = freighterWallet || telegramWallet;
    const walletType = freighterWallet ? "🦊 Freighter" : "📱 Telegram";

    if (!wallet) {
      bot.sendMessage(
        chatId,
        "❌ No wallet connected.\n\n" +
        "Connect a wallet via StellrFlow workflow.",
        { parse_mode: "HTML" }
      );
      return;
    }

    const network = freighterWallet?.network || STELLAR_NETWORK;

    bot.sendMessage(
      chatId,
      `${walletType} <b>Wallet</b>\n\n` +
      `<b>Address:</b>\n<code>${esc(wallet.publicKey)}</code>\n\n` +
      `📋 Copy this address to receive XLM.\n` +
      `Network: ${esc(network)}\n\n` +
      `<i>Use /qrcode to get a scannable QR code.</i>`,
      { parse_mode: "HTML" }
    );
  });

  // /qrcode — send wallet address as a QR code image
  bot.onText(/\/qrcode/, async (msg) => {
    const chatId = msg.chat.id.toString();
    const wallet = freighterWallets.get(chatId) || userWallets.get(chatId);

    if (!wallet) {
      bot.sendMessage(chatId, "❌ No wallet connected. Use /createwallet first.");
      return;
    }

    try {
      const qrBuffer = await QRCode.toBuffer(wallet.publicKey, {
        type: "png",
        width: 300,
        margin: 2,
        color: { dark: "#000000", light: "#FFFFFF" },
      });

      await bot.sendPhoto(chatId, qrBuffer, {
        caption: `📱 <b>Your Stellar Address</b>\n\n<code>${esc(wallet.publicKey)}</code>\n\n<i>Scan to receive XLM payments.</i>`,
        parse_mode: "HTML",
      });
    } catch {
      bot.sendMessage(chatId, "❌ Could not generate QR code.");
    }
  });

  // Disconnect wallet (works for both wallet types)
  bot.onText(/\/disconnect/, (msg) => {
    const chatId = msg.chat.id.toString();
    const hasFreighter = freighterWallets.has(chatId);
    const hasTelegram = userWallets.has(chatId);

    if (!hasFreighter && !hasTelegram) {
      bot.sendMessage(chatId, "❌ No wallet connected.");
      return;
    }

    const walletType = hasFreighter ? "Freighter" : "Telegram";

    // Remove the active wallet
    if (hasFreighter) {
      freighterWallets.delete(chatId);
    } else {
      userWallets.delete(chatId);
    }

    bot.sendMessage(
      chatId,
      `✅ ${walletType} wallet disconnected.\n\n` +
      "You can connect a new wallet via StellrFlow workflow.",
      { parse_mode: "HTML" }
    );
  });

  // === TELEGRAM WALLET SPECIFIC COMMANDS ===
  // These only work for Telegram wallets (where we control the private key)

  // Create wallet (only for Telegram wallet)
  bot.onText(/\/createwallet/, async (msg) => {
    const chatId = msg.chat.id.toString();
    trackCommand('createwallet', chatId);

    // Check if user already has a wallet
    if (userWallets.has(chatId)) {
      const wallet = userWallets.get(chatId)!;
      bot.sendMessage(
        chatId,
        `👛 You already have a wallet!\n\n` +
        `<b>Address:</b> \`${wallet.publicKey}\`\n\n` +
        `Use /mybalance to check your balance.`,
        { parse_mode: "HTML" }
      );
      return;
    }

    // Create new Stellar keypair
    const keypair = Keypair.random();
    const publicKey = keypair.publicKey();
    const secretKey = keypair.secret();

    // Store wallet
    metrics.totalWalletsCreated++;
    userWallets.set(chatId, {
      publicKey,
      secretKey,
      createdAt: new Date(),
    });

    bot.sendMessage(
      chatId,
      `🎉 <b>Wallet Created!</b>\n\n` +
      `<b>Your Stellar Address:</b>\n<code>${esc(publicKey)}</code>\n\n` +
      `⚠️ <b>Important:</b> Your wallet is stored securely. To use it on testnet:\n` +
      `1. Tap <b>Fund Wallet</b> below to get free testnet XLM\n` +
      `2. Or send XLM to your address from another wallet\n\n` +
      `Use /mybalance to check your balance anytime.`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "🚀 Fund Wallet", callback_data: "fund_wallet" },
            { text: "💰 Check Balance", callback_data: "check_balance" },
          ]],
        },
      }
    );
    showMainKeyboard(chatId, "✅ Wallet ready — quick actions pinned below:");
  });

  // Fund wallet with testnet XLM (Telegram wallet only)
  bot.onText(/\/fundwallet/, async (msg) => {
    const chatId = msg.chat.id.toString();
    const wallet = userWallets.get(chatId);
    const freighterWallet = freighterWallets.get(chatId);

    // Check if using Freighter
    if (freighterWallet && !wallet) {
      bot.sendMessage(
        chatId,
        "ℹ️ You're using a <b>Freighter wallet</b>.\n\n" +
        "Fund your Freighter wallet through an exchange or another wallet.\n" +
        "This command only works for Telegram in-bot wallets.",
        { parse_mode: "HTML" }
      );
      return;
    }

    if (!wallet) {
      bot.sendMessage(
        chatId,
        "❌ No wallet connected. Connect one via StellrFlow workflow.",
        { parse_mode: "HTML" }
      );
      return;
    }

    if (STELLAR_NETWORK !== "testnet") {
      bot.sendMessage(
        chatId,
        "❌ Funding is only available on testnet. You're on mainnet.",
        { parse_mode: "HTML" }
      );
      return;
    }

    try {
      bot.sendMessage(chatId, "⏳ Requesting testnet XLM...");

      const response = await fetch(
        `https://friendbot.stellar.org?addr=${wallet.publicKey}`
      );

      if (response.ok) {
        bot.sendMessage(
          chatId,
          `✅ <b>Wallet Funded!</b>\n\n` +
          `Your wallet has been credited with <b>10,000 testnet XLM</b>.\n\n` +
          `Ready to send? Use: <code>/send ADDRESS AMOUNT</code>`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [[
                { text: "💰 Check Balance", callback_data: "check_balance" },
                { text: "📤 Send XLM", callback_data: "send_help" },
              ]],
            },
          }
        );
      } else {
        bot.sendMessage(
          chatId,
          `❌ Failed to fund wallet. It might already be funded or Friendbot is busy. Try again in a minute.`
        );
      }
    } catch (err: any) {
      bot.sendMessage(
        chatId,
        `❌ Error: ${err.message || "Failed to fund wallet"}`,
        { parse_mode: "HTML" }
      );
    }
  });

  // === ANCHOR ON/OFF RAMP COMMANDS ===
  // Deposit fiat → XLM (On-Ramp)

  // /addfunds [amount] [currency] - Create deposit request
  bot.onText(/\/addfunds(?:\s+(\d+(?:\.\d+)?)\s*(\w+)?)?/, async (msg, match) => {
    const chatId = msg.chat.id.toString();
    const userId = msg.from?.id?.toString() || chatId;
    const telegramWallet = userWallets.get(chatId);
    const freighterWallet = freighterWallets.get(chatId);

    const wallet = freighterWallet || telegramWallet;

    if (!wallet) {
      bot.sendMessage(
        chatId,
        "❌ No wallet connected.\n\n" +
        "Connect a wallet first via StellrFlow workflow, then use /addfunds.",
        { parse_mode: "HTML" }
      );
      return;
    }

    const amountStr = match?.[1];
    const currency = match?.[2]?.toUpperCase() || 'USD';

    if (!amountStr) {
      // Show rate info and usage
      const usdRate = getExchangeRate('USD');
      const inrRate = getExchangeRate('INR');

      bot.sendMessage(
        chatId,
        "💰 <b>Add Funds (Deposit)</b>\n\n" +
        "Convert fiat to XLM and credit your wallet.\n\n" +
        "<b>Usage:</b> `/addfunds <amount> [currency]`\n\n" +
        "<b>Examples:</b>\n" +
        "• `/addfunds 100` - Deposit $100\n" +
        "• `/addfunds 100 USD` - Deposit $100\n" +
        "• `/addfunds 1000 INR` - Deposit ₹1000\n\n" +
        "<b>Current Rates (Demo):</b>\n" +
        `• 1 USD = ${usdRate.rate} XLM\n` +
        `• 1 INR = ${inrRate.rate} XLM\n\n` +
        "_Supported: USD, EUR, INR_",
        { parse_mode: "HTML" }
      );
      return;
    }

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      bot.sendMessage(chatId, "❌ Invalid amount. Please enter a positive number.");
      return;
    }

    try {
      // Get estimate first
      const estimate = getDepositEstimate(amount, currency);

      bot.sendMessage(
        chatId,
        `⏳ <b>Processing Deposit...</b>\n\n` +
        `<b>Amount:</b> ${amount} ${currency}\n` +
        `<b>Est. XLM:</b> ~${estimate.estimatedXLM.toFixed(4)} XLM\n` +
        `<b>Rate:</b> 1 ${currency} = ${estimate.rate} XLM`,
        { parse_mode: "HTML" }
      );

      // Create and auto-confirm deposit (hackathon demo mode)
      const result = await quickDeposit(userId, amount, currency, wallet.publicKey);

      if (result.success) {
        bot.sendMessage(
          chatId,
          `✅ <b>Deposit Successful!</b>\n\n` +
          `<b>Deposited:</b> ${amount} ${currency}\n` +
          `<b>Credited:</b> ${result.creditedXLM.toFixed(4)} XLM\n` +
          `<b>Deposit ID:</b> \`${result.depositId}\`\n` +
          (result.stellarTxHash ? `<b>Tx:</b> \`${result.stellarTxHash.slice(0, 12)}...\`\n` : '') +
          `\nUse /mybalance to check your updated balance.`,
          { parse_mode: "HTML" }
        );
      } else {
        bot.sendMessage(
          chatId,
          `❌ <b>Deposit Failed</b>\n\n${result.message}\n\n` +
          `_For testnet, try /fundwallet instead._`,
          { parse_mode: "HTML" }
        );
      }
    } catch (err: any) {
      bot.sendMessage(
        chatId,
        `❌ Error: ${err.message || "Deposit failed"}`,
        { parse_mode: "HTML" }
      );
    }
  });

  // /withdraw [amount] [currency] - Create withdrawal request
  bot.onText(/\/withdraw(?:\s+(\d+(?:\.\d+)?)\s*(\w+)?)?/, async (msg, match) => {
    const chatId = msg.chat.id.toString();
    const userId = msg.from?.id?.toString() || chatId;
    const telegramWallet = userWallets.get(chatId);
    const freighterWallet = freighterWallets.get(chatId);

    const wallet = freighterWallet || telegramWallet;
    const walletType = freighterWallet ? "🦊 Freighter" : "📱 Telegram";

    if (!wallet) {
      bot.sendMessage(
        chatId,
        "❌ No wallet connected.\n\n" +
        "Connect a wallet first via StellrFlow workflow, then use /withdraw.",
        { parse_mode: "HTML" }
      );
      return;
    }

    const amountStr = match?.[1];
    const currency = match?.[2]?.toUpperCase() || 'USD';

    if (!amountStr) {
      // Show rate info and usage
      const estimate = getWithdrawalEstimate(10, 'USD');

      bot.sendMessage(
        chatId,
        "💸 <b>Withdraw Funds (Off-Ramp)</b>\n\n" +
        "Convert XLM to fiat and withdraw.\n\n" +
        "<b>Usage:</b> `/withdraw <xlm_amount> [currency]`\n\n" +
        "<b>Examples:</b>\n" +
        "• `/withdraw 10` - Withdraw 10 XLM to USD\n" +
        "• `/withdraw 50 EUR` - Withdraw 50 XLM to EUR\n" +
        "• `/withdraw 100 INR` - Withdraw 100 XLM to INR\n\n" +
        "<b>Current Rate (Demo):</b>\n" +
        `• 10 XLM = ~$${estimate.estimatedFiat} USD\n\n` +
        "_Supported: USD, EUR, INR_",
        { parse_mode: "HTML" }
      );
      return;
    }

    const xlmAmount = parseFloat(amountStr);
    if (isNaN(xlmAmount) || xlmAmount <= 0) {
      bot.sendMessage(chatId, "❌ Invalid amount. Please enter a positive number.");
      return;
    }

    try {
      // Check balance first
      const account = await horizon.loadAccount(wallet.publicKey);
      const xlmBalance = account.balances.find((b: any) => b.asset_type === "native");
      const balance = xlmBalance && "balance" in xlmBalance ? parseFloat(xlmBalance.balance) : 0;

      if (balance < xlmAmount) {
        bot.sendMessage(
          chatId,
          `❌ <b>Insufficient Balance</b>\n\n` +
          `<b>Requested:</b> ${xlmAmount} XLM\n` +
          `<b>Available:</b> ${balance.toFixed(4)} XLM\n\n` +
          `Use /addfunds to deposit more.`,
          { parse_mode: "HTML" }
        );
        return;
      }

      // Get estimate
      const estimate = getWithdrawalEstimate(xlmAmount, currency);

      bot.sendMessage(
        chatId,
        `⏳ <b>Processing Withdrawal...</b>\n\n` +
        `<b>XLM Amount:</b> ${xlmAmount} XLM\n` +
        `<b>Est. Payout:</b> ~${estimate.estimatedFiat} ${currency}`,
        { parse_mode: "HTML" }
      );

      // Process withdrawal (hackathon demo mode - simulated)
      const result = await quickWithdrawal(userId, xlmAmount, currency, wallet.publicKey);

      if (result.success) {
        bot.sendMessage(
          chatId,
          `✅ <b>Withdrawal Processed!</b>\n\n` +
          `<b>Withdrawn:</b> ${result.xlmDebited} XLM\n` +
          `<b>Payout:</b> ${result.fiatPayout} ${result.currency}\n` +
          `<b>Withdrawal ID:</b> \`${result.withdrawalId}\`\n` +
          `<b>ETA:</b> ${result.eta}\n` +
          (result.stellarTxHash ? `<b>Tx:</b> \`${result.stellarTxHash.slice(0, 12)}...\`\n` : '') +
          `\n_Demo: In production, funds would be sent to your bank._`,
          { parse_mode: "HTML" }
        );
      } else {
        bot.sendMessage(
          chatId,
          `❌ <b>Withdrawal Failed</b>\n\n${result.message}`,
          { parse_mode: "HTML" }
        );
      }
    } catch (err: any) {
      if (err?.response?.status === 404) {
        bot.sendMessage(
          chatId,
          `❌ Wallet not funded on Stellar network.\n\n` +
          `Use /fundwallet first to activate your account.`,
          { parse_mode: "HTML" }
        );
      } else {
        bot.sendMessage(
          chatId,
          `❌ Error: ${err.message || "Withdrawal failed"}`,
          { parse_mode: "HTML" }
        );
      }
    }
  });

  // /rates - Show current exchange rates
  bot.onText(/\/rates/, (msg) => {
    const chatId = msg.chat.id.toString();

    const usdRate = getExchangeRate('USD');
    const eurRate = getExchangeRate('EUR');
    const inrRate = getExchangeRate('INR');

    bot.sendMessage(
      chatId,
      `📊 <b>Exchange Rates (Demo)</b>\n\n` +
      `<b>Deposit (Fiat → XLM):</b>\n` +
      `• 1 USD = ${usdRate.rate} XLM\n` +
      `• 1 EUR = ${eurRate.rate.toFixed(2)} XLM\n` +
      `• 1 INR = ${inrRate.rate} XLM\n\n` +
      `<b>Withdraw (XLM → Fiat):</b>\n` +
      `• 1 XLM = $${(1 / usdRate.rate).toFixed(2)} USD\n` +
      `• 1 XLM = €${(1 / eurRate.rate).toFixed(2)} EUR\n` +
      `• 1 XLM = ₹${(1 / inrRate.rate).toFixed(2)} INR\n\n` +
      `<i>Demo rates for hackathon.</i>`,
      { parse_mode: "HTML" }
    );
  });

  // /txhistory - Show real on-chain Stellar transactions from Horizon
  bot.onText(/\/txhistory/, async (msg) => {
    const chatId = msg.chat.id.toString();
    const userId = msg.from?.id?.toString() || chatId;
    const wallet = freighterWallets.get(chatId) || userWallets.get(chatId);

    if (!wallet) {
      bot.sendMessage(chatId, "❌ No wallet connected.");
      return;
    }

    bot.sendMessage(chatId, "⏳ Loading transactions...");

    try {
      const res = await fetch(
        `https://horizon-testnet.stellar.org/accounts/${wallet.publicKey}/transactions?limit=10&order=desc`,
        { signal: AbortSignal.timeout(8000) }
      );

      if (!res.ok) throw new Error("Horizon error");
      const data: any = await res.json();
      const txs: any[] = data._embedded?.records ?? [];

      if (txs.length === 0) {
        bot.sendMessage(chatId, "📋 No on-chain transactions yet.\n\nUse /fundwallet then /send to get started.");
        return;
      }

      let text = "📋 <b>On-Chain Transactions</b> (last 10)\n\n";
      for (const tx of txs) {
        const date = new Date(tx.created_at).toLocaleDateString("en-GB");
        const hash = tx.hash as string;
        const memo = tx.memo ? ` · <i>${esc(String(tx.memo))}</i>` : "";
        const ops = tx.operation_count ?? "?";
        text += `• ${date} · ${ops} op(s)${memo}\n  <a href="https://stellar.expert/explorer/testnet/tx/${esc(hash)}">${esc(hash.slice(0, 10))}...</a>\n\n`;
      }

      // Also show anchor history if any
      const deps = getUserDeposits(userId);
      const wdrs = getUserWithdrawals(userId);
      if (deps.length > 0 || wdrs.length > 0) {
        text += "─────────────────\n<b>Anchor History</b>\n";
        for (const d of deps.slice(-3)) {
          const icon = d.status === 'completed' ? '✅' : d.status === 'failed' ? '❌' : '⏳';
          text += `${icon} +${d.creditedXLM || d.estimatedXLM} XLM (deposit, ${d.status})\n`;
        }
        for (const w of wdrs.slice(-3)) {
          const icon = w.status === 'completed' ? '✅' : w.status === 'failed' ? '❌' : '⏳';
          text += `${icon} -${w.xlmAmount} XLM (withdraw, ${w.status})\n`;
        }
      }

      bot.sendMessage(chatId, text, { parse_mode: "HTML" });
    } catch (err: any) {
      if (err?.response?.status === 404) {
        bot.sendMessage(chatId, "📋 Wallet not yet activated on Stellar. Use /fundwallet first.");
      } else {
        bot.sendMessage(chatId, "❌ Could not load transactions. Try again in a moment.");
      }
    }
  });

  // /depositstatus <id> - Check a specific deposit
  bot.onText(/\/depositstatus(?:\s+(\S+))?/, (msg, match) => {
    const chatId = msg.chat.id.toString();
    const depositId = match?.[1]?.trim();

    if (!depositId) {
      bot.sendMessage(chatId, "Usage: <code>/depositstatus DEP-XXXXX</code>", { parse_mode: "HTML" });
      return;
    }

    const d = getDeposit(depositId);
    if (!d) {
      bot.sendMessage(chatId, `❌ Deposit <code>${esc(depositId)}</code> not found.`, { parse_mode: "HTML" });
      return;
    }

    const icon = d.status === 'completed' ? '✅' : d.status === 'failed' ? '❌' : '⏳';
    bot.sendMessage(
      chatId,
      `${icon} <b>Deposit Details</b>\n\n` +
      `<b>ID:</b> <code>${esc(d.depositId)}</code>\n` +
      `<b>Status:</b> ${esc(d.status)}\n` +
      `<b>Amount:</b> ${d.fiatAmount} ${esc(d.currency)}\n` +
      `<b>XLM Credited:</b> ${d.creditedXLM || '—'}\n` +
      `<b>Rate:</b> 1 ${esc(d.currency)} = ${d.exchangeRate} XLM\n` +
      (d.stellarTxHash ? `<b>Stellar Tx:</b> <code>${esc(d.stellarTxHash.slice(0, 16))}...</code>\n` : '') +
      `<b>Created:</b> ${new Date(d.createdAt).toLocaleString()}`,
      { parse_mode: "HTML" }
    );
  });

  // /withdrawstatus <id> - Check a specific withdrawal
  bot.onText(/\/withdrawstatus(?:\s+(\S+))?/, (msg, match) => {
    const chatId = msg.chat.id.toString();
    const wdrId = match?.[1]?.trim();

    if (!wdrId) {
      bot.sendMessage(chatId, "Usage: <code>/withdrawstatus WDR-XXXXX</code>", { parse_mode: "HTML" });
      return;
    }

    const w = getWithdrawal(wdrId);
    if (!w) {
      bot.sendMessage(chatId, `❌ Withdrawal <code>${esc(wdrId)}</code> not found.`, { parse_mode: "HTML" });
      return;
    }

    const icon = w.status === 'completed' ? '✅' : w.status === 'failed' ? '❌' : '⏳';
    bot.sendMessage(
      chatId,
      `${icon} <b>Withdrawal Details</b>\n\n` +
      `<b>ID:</b> <code>${esc(w.withdrawalId)}</code>\n` +
      `<b>Status:</b> ${esc(w.status)}\n` +
      `<b>XLM Debited:</b> ${w.xlmAmount}\n` +
      `<b>Fiat Payout:</b> ${w.actualFiatPayout || w.estimatedFiat} ${esc(w.currency)}\n` +
      `<b>ETA:</b> ${esc(w.eta)}\n` +
      (w.stellarTxHash ? `<b>Stellar Tx:</b> <code>${esc(w.stellarTxHash.slice(0, 16))}...</code>\n` : '') +
      `<b>Created:</b> ${new Date(w.createdAt).toLocaleString()}`,
      { parse_mode: "HTML" }
    );
  });

  // Persistent quick-action keyboard shown after wallet-connected actions
  function showMainKeyboard(chatId: string, message: string) {
    bot.sendMessage(chatId, message, {
      reply_markup: {
        keyboard: [
          [{ text: "💰 Balance" }, { text: "📤 Send XLM" }, { text: "📋 History" }],
          [{ text: "💱 Rates" }, { text: "❓ Help" }],
        ],
        resize_keyboard: true,
        is_persistent: true,
      },
    });
  }

  // /addcontact NAME ADDRESS — save to address book
  bot.onText(/\/addcontact(?:\s+(\S+)\s+(\S+))?/, (msg, match) => {
    const chatId = msg.chat.id.toString();
    const name = match?.[1]?.trim();
    const address = match?.[2]?.trim();

    if (!name || !address) {
      bot.sendMessage(chatId,
        "<b>Add Contact</b>\n\nUsage: <code>/addcontact NAME ADDRESS</code>\nExample: <code>/addcontact Alice GABC...XYZ</code>",
        { parse_mode: "HTML" }
      );
      return;
    }
    if (!/^G[A-Z2-7]{55}$/.test(address)) {
      bot.sendMessage(chatId, "❌ Invalid Stellar address. Must start with G and be 56 characters.");
      return;
    }
    getContacts(chatId).set(name.toLowerCase(), address);
    bot.sendMessage(chatId, `✅ <b>${esc(name)}</b> saved.\n<code>${esc(address)}</code>`, { parse_mode: "HTML" });
  });

  // /contacts — list address book
  bot.onText(/\/contacts/, (msg) => {
    const chatId = msg.chat.id.toString();
    const contacts = getContacts(chatId);
    if (contacts.size === 0) {
      bot.sendMessage(chatId,
        "📒 Address book is empty.\n\nAdd contacts with:\n<code>/addcontact NAME ADDRESS</code>",
        { parse_mode: "HTML" }
      );
      return;
    }
    let text = "📒 <b>Address Book</b>\n\n";
    for (const [name, addr] of contacts) {
      text += `<b>${esc(name)}</b>\n<code>${esc(addr.slice(0, 8))}...${esc(addr.slice(-8))}</code>\n\n`;
    }
    text += "<i>Send to a contact: /send NAME AMOUNT</i>";
    bot.sendMessage(chatId, text, { parse_mode: "HTML" });
  });

  // /deletecontact NAME — remove from address book
  bot.onText(/\/deletecontact(?:\s+(.+))?/, (msg, match) => {
    const chatId = msg.chat.id.toString();
    const name = match?.[1]?.trim()?.toLowerCase();
    if (!name) { bot.sendMessage(chatId, "Usage: <code>/deletecontact NAME</code>", { parse_mode: "HTML" }); return; }
    const contacts = getContacts(chatId);
    if (contacts.delete(name)) {
      bot.sendMessage(chatId, `✅ Contact <b>${esc(name)}</b> removed.`, { parse_mode: "HTML" });
    } else {
      bot.sendMessage(chatId, `❌ Contact <b>${esc(name)}</b> not found.`, { parse_mode: "HTML" });
    }
  });

  // /exportwallet — DM the user their secret key with a warning
  bot.onText(/\/exportwallet/, async (msg) => {
    const chatId = msg.chat.id.toString();
    const wallet = userWallets.get(chatId);

    if (!wallet) {
      bot.sendMessage(chatId, "❌ No in-bot wallet found. This command only works for Telegram wallets.");
      return;
    }

    // Only allow in private chats, not groups
    if (msg.chat.type !== "private") {
      bot.sendMessage(chatId, "🔒 For security, /exportwallet only works in a private chat with the bot.");
      return;
    }

    bot.sendMessage(
      chatId,
      `🔑 <b>Wallet Backup</b>\n\n` +
      `⚠️ <b>Keep this secret. Never share it.</b>\n\n` +
      `<b>Public key:</b>\n<code>${esc(wallet.publicKey)}</code>\n\n` +
      `<b>Secret key:</b>\n<code>${esc(wallet.secretKey)}</code>\n\n` +
      `<i>This is a testnet wallet with no real value. Store it safely if you want to reuse it.</i>`,
      { parse_mode: "HTML" }
    );
  });

  // /watchbalance — poll Horizon every 30s and notify on change
  bot.onText(/\/watchbalance/, async (msg) => {
    const chatId = msg.chat.id.toString();
    const wallet = freighterWallets.get(chatId) || userWallets.get(chatId);
    if (!wallet) { bot.sendMessage(chatId, "❌ No wallet connected."); return; }

    if (balanceWatchers.has(chatId)) {
      bot.sendMessage(chatId, "👀 Already watching your balance. Use /stopwatch to stop.");
      return;
    }

    let lastBalance = "";
    const poll = async () => {
      try {
        const res = await fetch(
          `https://horizon-testnet.stellar.org/accounts/${wallet.publicKey}/transactions?limit=1&order=desc`,
          { signal: AbortSignal.timeout(6000) }
        );
        const account = await horizon.loadAccount(wallet.publicKey);
        const xlm = account.balances.find((b) => b.asset_type === "native");
        const bal = xlm && "balance" in xlm ? xlm.balance : "0";
        if (lastBalance && bal !== lastBalance) {
          const prev = parseFloat(lastBalance);
          const curr = parseFloat(bal);
          const diff = curr - prev;
          const sign = diff > 0 ? "+" : "";
          bot.sendMessage(
            chatId,
            `🔔 <b>Balance Changed!</b>\n\n${sign}${fmtXLM(diff.toFixed(7))} XLM\n<b>New balance:</b> ${fmtXLM(bal)} XLM`,
            { parse_mode: "HTML" }
          );
        }
        lastBalance = bal;
      } catch { /* ignore transient errors */ }
    };

    await poll(); // seed lastBalance immediately
    const id = setInterval(poll, 30_000);
    balanceWatchers.set(chatId, id);
    bot.sendMessage(chatId, "👀 <b>Watching your balance.</b> I'll notify you when it changes.\n\nUse /stopwatch to stop.", { parse_mode: "HTML" });
  });

  bot.onText(/\/stopwatch/, (msg) => {
    const chatId = msg.chat.id.toString();
    const id = balanceWatchers.get(chatId);
    if (!id) { bot.sendMessage(chatId, "ℹ️ No active balance watcher."); return; }
    clearInterval(id);
    balanceWatchers.delete(chatId);
    bot.sendMessage(chatId, "🛑 Balance watcher stopped.");
  });

  // Send XLM from wallet — /send [ADDR|AMOUNT] [AMOUNT|ADDR] [memo TEXT]
  bot.onText(/\/send(?:\s+(\S+)\s+(\S+)(?:\s+memo\s+(.+))?)?/, async (msg, match) => {
    const chatId = msg.chat.id.toString();
    const wallet = userWallets.get(chatId);
    const freighterWallet = freighterWallets.get(chatId);

    let destAddress = match?.[1]?.trim();
    let amountStr = match?.[2]?.trim();
    const memo = match?.[3]?.trim();

    // Accept both "/send ADDR AMOUNT" and "/send AMOUNT ADDR" — auto-detect order
    if (destAddress && amountStr && /^\d+(\.\d+)?$/.test(destAddress)) {
      [destAddress, amountStr] = [amountStr, destAddress];
    }

    // Resolve contact name → address if destAddress isn't a Stellar key
    if (destAddress && !/^G[A-Z2-7]{55}$/.test(destAddress)) {
      const resolved = getContacts(chatId).get(destAddress.toLowerCase());
      if (resolved) {
        destAddress = resolved;
      } else {
        bot.sendMessage(chatId,
          `❌ <b>${esc(destAddress)}</b> is not a valid Stellar address or saved contact.\n\nCheck /contacts or use the full address.`,
          { parse_mode: "HTML" }
        );
        return;
      }
    }

    // Handle Freighter wallet - generate signing link
    if (freighterWallet && !wallet) {
      if (!destAddress || !amountStr) {
        bot.sendMessage(
          chatId,
          "<b>Send XLM (Freighter)</b>\n\n" +
          "Usage: <code>/send ADDRESS AMOUNT</code>\n" +
          "Also: <code>/send AMOUNT ADDRESS</code>\n\n" +
          "Example: <code>/send GABC...XYZ 10</code>\n\n" +
          "You'll receive a link to sign the transaction with Freighter.",
          { parse_mode: "HTML" }
        );
        return;
      }

      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) {
        bot.sendMessage(chatId, "❌ Invalid amount. Please enter a positive number.");
        return;
      }

      // Generate link to send-transaction page
      const sendUrl = `http://localhost:3000/send-transaction?chatId=${chatId}&destination=${encodeURIComponent(destAddress)}&amount=${amount}&network=${freighterWallet.network}`;

      bot.sendMessage(
        chatId,
        `🦊 <b>Sign Transaction with Freighter</b>\n\n` +
        `<b>To:</b> <code>${destAddress.slice(0, 8)}...${destAddress.slice(-8)}</code>\n` +
        `<b>Amount:</b> ${amount} XLM\n\n` +
        `👉 <a href="${sendUrl}">Click here to sign &amp; send</a>\n\n` +
        `<i>Open this link in your browser with Freighter installed.</i>`,
        { parse_mode: "HTML" }
      );
      return;
    }

    if (!wallet) {
      bot.sendMessage(
        chatId,
        "❌ No wallet connected. Connect one via StellrFlow workflow.",
        { parse_mode: "HTML" }
      );
      return;
    }

    if (!destAddress || !amountStr) {
      bot.sendMessage(
        chatId,
        "<b>Send XLM</b>\n\n" +
        "Usage: <code>/send ADDRESS AMOUNT</code>\n" +
        "Also: <code>/send AMOUNT ADDRESS</code>\n\n" +
        "Example: <code>/send GABC...XYZ 10</code>\n\n" +
        "This will send XLM directly from your wallet.",
        { parse_mode: "HTML" }
      );
      return;
    }

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      bot.sendMessage(
        chatId,
        `❌ <b>Invalid amount:</b> <code>${esc(amountStr ?? "")}</code>\n\n` +
        `Try: <code>/send ${esc(destAddress ?? "ADDRESS")} 10</code>`,
        { parse_mode: "HTML" }
      );
      return;
    }

    // Show confirmation before sending
    pendingSends.set(chatId, { destAddress: destAddress!, amount, memo: memo || undefined });
    bot.sendMessage(
      chatId,
      `📤 <b>Confirm Transaction</b>\n\n` +
      `<b>To:</b> <code>${esc(destAddress!.slice(0, 8))}...${esc(destAddress!.slice(-8))}</code>\n` +
      `<b>Amount:</b> ${amount} XLM\n` +
      (memo ? `<b>Memo:</b> ${esc(memo)}\n` : "") +
      `<b>Fee:</b> ~0.00001 XLM\n\n` +
      `<i>This cannot be undone.</i>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Confirm", callback_data: "send_confirm" },
            { text: "❌ Cancel", callback_data: "send_cancel" },
          ]],
        },
      }
    );
    return;

  });

  // Extracted: execute a confirmed XLM send for a Telegram wallet
  async function executeSend(chatId: string, destAddress: string, amount: number, memo?: string) {
    const wallet = userWallets.get(chatId);
    if (!wallet) { bot.sendMessage(chatId, "❌ No wallet found."); return; }

    bot.sendMessage(chatId, "⏳ Sending...");
    try {
      const sourceKeypair = Keypair.fromSecret(wallet.secretKey);
      const sourceAccount = await horizon.loadAccount(wallet.publicKey);

      let destinationExists = true;
      try { await horizon.loadAccount(destAddress); } catch { destinationExists = false; }

      const networkPassphrase = STELLAR_NETWORK === "testnet" ? Networks.TESTNET : Networks.PUBLIC;
      let txBuilder = new TransactionBuilder(sourceAccount, { fee: BASE_FEE, networkPassphrase });

      if (destinationExists) {
        txBuilder = txBuilder.addOperation(Operation.payment({
          destination: destAddress, asset: Asset.native(), amount: amount.toFixed(7),
        }));
      } else {
        if (amount < 1) {
          bot.sendMessage(chatId, "❌ New account needs at least <b>1 XLM</b> to activate.", { parse_mode: "HTML" });
          return;
        }
        txBuilder = txBuilder.addOperation(Operation.createAccount({
          destination: destAddress, startingBalance: amount.toFixed(7),
        }));
      }

      if (memo) txBuilder = txBuilder.addMemo({ type: "text", value: memo } as any);
      const transaction = txBuilder.setTimeout(30).build();
      transaction.sign(sourceKeypair);
      const result = await horizon.submitTransaction(transaction);

      bot.sendMessage(
        chatId,
        `✅ <b>Transaction Successful!</b>\n\n` +
        `<b>Sent:</b> ${amount} XLM\n` +
        `<b>To:</b> <code>${esc(destAddress.slice(0, 8))}...${esc(destAddress.slice(-8))}</code>\n` +
        (memo ? `<b>Memo:</b> ${esc(memo)}\n` : "") +
        `\n🔗 <a href="https://stellar.expert/explorer/${STELLAR_NETWORK}/tx/${esc(result.hash)}">View on Explorer</a>`,
        { parse_mode: "HTML" }
      );

      // Record this run on-chain (non-blocking — send already succeeded).
      logRunOnChain(chatId, wallet.secretKey, "telegram-send", 1);
    } catch (err: any) {
      const bal = err?.response?.data?.extras?.result_codes?.operations?.[0];
      const hint = bal === "op_underfunded"
        ? "\n\n💡 Your balance is too low. Use /fundwallet."
        : bal === "op_no_destination"
        ? "\n\n💡 Destination doesn't exist. Send at least 1 XLM to create it."
        : "";
      const errorMsg = err?.response?.data?.extras?.result_codes
        ? JSON.stringify(err.response.data.extras.result_codes)
        : err.message || "Transaction failed";
      bot.sendMessage(chatId, `❌ <b>Transaction failed:</b> ${esc(errorMsg)}${hint}`, { parse_mode: "HTML" });
    }
  }

  // Inline keyboard button handlers
  bot.on("callback_query", async (query) => {
    const chatId = query.message?.chat.id.toString();
    if (!chatId) return;
    await bot.answerCallbackQuery(query.id);

    if (query.data === "check_balance") {
      const wallet = freighterWallets.get(chatId) || userWallets.get(chatId);
      if (!wallet) { bot.sendMessage(chatId, "❌ No wallet connected."); return; }
      const walletType = freighterWallets.has(chatId) ? "🦊 Freighter" : "📱 Telegram";
      try {
        const account = await horizon.loadAccount(wallet.publicKey);
        const xlm = account.balances.find((b) => b.asset_type === "native");
        const bal = xlm && "balance" in xlm ? xlm.balance : "0";
        bot.sendMessage(chatId, `${walletType} <b>Balance:</b> ${fmtXLM(bal)} XLM`, { parse_mode: "HTML" });
      } catch {
        bot.sendMessage(chatId, "❌ Could not load balance. Try /mybalance.");
      }
    } else if (query.data === "fund_wallet") {
      const wallet = userWallets.get(chatId);
      if (!wallet) { bot.sendMessage(chatId, "ℹ️ /fundwallet only works with a Telegram in-bot wallet."); return; }
      bot.sendMessage(chatId, "⏳ Requesting testnet XLM...");
      try {
        const res = await fetch(`https://friendbot.stellar.org?addr=${wallet.publicKey}`);
        if (res.ok) {
          bot.sendMessage(chatId, `✅ <b>Funded!</b> 10,000 testnet XLM added.\n\nUse /mybalance to confirm.`, { parse_mode: "HTML" });
        } else {
          bot.sendMessage(chatId, "❌ Funding failed — wallet may already be funded. Try /mybalance.");
        }
      } catch {
        bot.sendMessage(chatId, "❌ Funding failed. Try /fundwallet again.");
      }
    } else if (query.data === "send_help") {
      bot.sendMessage(
        chatId,
        "<b>Send XLM</b>\n\n" +
        "Usage: <code>/send ADDRESS AMOUNT</code>\n" +
        "Also: <code>/send AMOUNT ADDRESS</code>\n\n" +
        "Example: <code>/send GABC...XYZ 10</code>",
        { parse_mode: "HTML" }
      );
    } else if (query.data === "refresh_balance") {
      const wallet = freighterWallets.get(chatId) || userWallets.get(chatId);
      if (!wallet) { bot.sendMessage(chatId, "❌ No wallet connected."); return; }
      const walletType = freighterWallets.has(chatId) ? "🦊 Freighter" : "📱 Telegram";
      try {
        const account = await horizon.loadAccount(wallet.publicKey);
        const xlm = account.balances.find((b) => b.asset_type === "native");
        const bal = xlm && "balance" in xlm ? xlm.balance : "0";
        bot.sendMessage(
          chatId,
          `${walletType} <b>Balance:</b> ${fmtXLM(bal)} XLM\n<i>Updated just now</i>`,
          { parse_mode: "HTML" }
        );
      } catch {
        bot.sendMessage(chatId, "❌ Could not refresh. Try /mybalance.");
      }

    // ── Send confirmation ─────────────────────────────────────────────────────
    } else if (query.data === "send_confirm") {
      const pending = pendingSends.get(chatId);
      pendingSends.delete(chatId);
      if (!pending) { bot.sendMessage(chatId, "❌ No pending transaction. Try /send again."); return; }
      await executeSend(chatId, pending.destAddress, pending.amount, pending.memo);
    } else if (query.data === "send_cancel") {
      pendingSends.delete(chatId);
      bot.sendMessage(chatId, "❌ Transaction cancelled.");

    // ── Onboarding callbacks ──────────────────────────────────────────────────
    } else if (query.data === "onboard_create") {
      bot.sendMessage(
        chatId,
        "🆕 <b>Create your Stellar wallet</b>\n\nRun this command to generate a wallet stored in the bot:\n\n<code>/createwallet</code>",
        { parse_mode: "HTML" }
      );
    } else if (query.data === "onboard_freighter") {
      bot.sendMessage(
        chatId,
        "🦊 <b>Connect Freighter</b>\n\nFreighter is a browser extension wallet. To connect it to this bot:\n\n1. Open StellrFlow at your frontend URL\n2. Click <b>Connect Wallet</b> → Freighter\n3. Run a workflow with the Telegram trigger\n\nYour Freighter wallet will then be linked to this chat.",
        { parse_mode: "HTML" }
      );
    } else if (query.data === "onboard_explain") {
      bot.sendMessage(
        chatId,
        "❓ <b>In-Bot Wallet vs Freighter</b>\n\n" +
        "<b>📱 In-Bot Wallet</b>\n• Created instantly here in Telegram\n• Key stored on the bot server\n• Works on testnet only\n• Good for quick demos\n\n" +
        "<b>🦊 Freighter Wallet</b>\n• Your own browser extension\n• You control the private key\n• Works on mainnet\n• More secure\n\n" +
        "For hackathon testing, tap <b>Create In-Bot Wallet</b>.",
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🆕 Create In-Bot Wallet", callback_data: "onboard_create" }],
              [{ text: "🦊 I have Freighter", callback_data: "onboard_freighter" }],
            ],
          },
        }
      );

    // ── Misc callbacks ────────────────────────────────────────────────────────
    } else if (query.data === "show_help") {
      bot.sendMessage(
        chatId,
        "<b>StellrFlow Bot Commands</b>\n\n" +
        "/mybalance — Your wallet balance\n" +
        "/send ADDR AMOUNT — Send XLM\n" +
        "/txhistory — On-chain transactions\n" +
        "/contacts — Address book\n" +
        "/fundwallet — Get testnet XLM\n" +
        "/rates — Exchange rates\n" +
        "/exportwallet — Backup your key\n" +
        "/watchbalance — Balance notifications\n" +
        "/help — Full command list",
        { parse_mode: "HTML" }
      );
    } else if (query.data === "tx_history") {
      // Trigger real tx history (reuse handler logic inline)
      const wallet = freighterWallets.get(chatId) || userWallets.get(chatId);
      if (!wallet) { bot.sendMessage(chatId, "❌ No wallet connected."); return; }
      bot.sendMessage(chatId, "⏳ Loading transactions...");
      try {
        const res = await fetch(
          `https://horizon-testnet.stellar.org/accounts/${wallet.publicKey}/transactions?limit=5&order=desc`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (!res.ok) throw new Error("Horizon error");
        const data: any = await res.json();
        const txs: any[] = data._embedded?.records ?? [];
        if (txs.length === 0) {
          bot.sendMessage(chatId, "📋 No transactions found on-chain yet.\n\nUse /fundwallet then /send to create some.");
          return;
        }
        let text = "📋 <b>Recent Transactions</b>\n\n";
        for (const tx of txs) {
          const date = new Date(tx.created_at).toLocaleDateString();
          const hash = tx.hash as string;
          text += `• ${date} — <a href="https://stellar.expert/explorer/testnet/tx/${esc(hash)}">${esc(hash.slice(0, 8))}...</a>\n`;
        }
        bot.sendMessage(chatId, text, { parse_mode: "HTML" });
      } catch {
        bot.sendMessage(chatId, "❌ Could not load transactions. Try /txhistory.");
      }
    }
  });

  // Persistent keyboard shortcut text → dispatch as equivalent command message
  bot.on("message", (msg) => {
    const chatId = msg.chat.id.toString();
    const text = msg.text?.trim();
    if (!text) return;
    const aliasMap: Record<string, string> = {
      "💰 Balance": "/mybalance",
      "📤 Send XLM": "/send",
      "📋 History": "/txhistory",
      "💱 Rates": "/rates",
      "❓ Help": "/help",
    };
    if (aliasMap[text]) {
      // Re-process as if the user typed the command
      bot.processUpdate({
        update_id: 0,
        message: { ...msg, text: aliasMap[text] },
      });
    }
  });

  // Chatbot mode: answer Stellar questions (only when chatbot feature is enabled)
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id.toString();
    const text = msg.text?.trim() || "";

    // Skip commands (handled above)
    if (text.startsWith("/")) return;

    // Check if this chat has chatbot feature enabled
    const session = activeSessions.get(chatId);
    const hasChatbot = session?.features.includes("chatbot");

    // If no session or chatbot not enabled, send a helpful message
    if (!session) {
      // No active session - user hasn't connected via StellrFlow
      return; // Silent - don't respond to random messages
    }

    if (!hasChatbot) {
      await bot.sendMessage(
        chatId,
        "💡 To enable the AI chatbot, connect the <b>Stellar SDK (Chatbot)</b> block to your Telegram trigger in StellrFlow and run the workflow again.",
        { parse_mode: "HTML" }
      );
      return;
    }

    // Chatbot is enabled — try keyword shortcuts first, then fall through to OpenAI
    if (text.length > 2) {
      try {
        const lower = text.toLowerCase();
        let reply = "";

        if (lower.includes("balance")) {
          const addrMatch = text.match(/G[A-Z2-7]{55}/);
          if (addrMatch) {
            const account = await horizon.loadAccount(addrMatch[0]);
            const xlm = account.balances.find((b) => b.asset_type === "native");
            const bal = xlm && "balance" in xlm ? xlm.balance : "0";
            reply = `💰 <b>Balance:</b> ${fmtXLM(bal)} XLM`;
          } else {
            reply = "Use <code>/balance G...</code> with a Stellar address to check balance.";
          }
        } else if (lower.includes("what is stellar") || lower.includes("about stellar")) {
          reply =
            "🌟 <b>Stellar</b> is a decentralized, open-source blockchain for fast, low-cost cross-border payments.\n\n" +
            "• Transactions settle in 3-5 seconds\n" +
            "• Fees are ~0.00001 XLM (~$0.000001)\n" +
            "• Built-in DEX for asset exchange\n\n" +
            "📚 https://developers.stellar.org";
        } else if (lower.includes("soroban")) {
          reply =
            "🔧 <b>Soroban</b> is Stellar's smart contract platform.\n\n" +
            "• Written in Rust, compiled to WASM\n" +
            "• Predictable gas fees\n" +
            "• Built-in testing framework\n\n" +
            "📚 https://soroban.stellar.org";
        } else if (lower.includes("anchor") || lower.includes("sep")) {
          reply =
            "⚓ <b>Anchors</b> are bridges between Stellar and traditional finance.\n\n" +
            "• SEP-6: Deposit/withdraw fiat\n" +
            "• SEP-10: Authentication\n" +
            "• SEP-24: Interactive deposits\n\n" +
            "📚 https://developers.stellar.org/docs/anchoring-assets";
        } else if (lower.includes("xlm") || lower.includes("lumen")) {
          reply =
            "💫 <b>XLM (Lumens)</b> is Stellar's native currency.\n\n" +
            "• Pays transaction fees\n" +
            "• Minimum balance requirements\n" +
            "• Bridge currency for exchange\n\n" +
            `Network: ${esc(STELLAR_NETWORK)}`;
        } else if (lower.includes("freighter")) {
          reply =
            "👛 <b>Freighter</b> is the most popular Stellar wallet browser extension.\n\n" +
            "• Secure key management\n" +
            "• Signs Soroban transactions\n\n" +
            "🔗 https://freighter.app";
        } else if (lower.includes("horizon") || lower.includes("api")) {
          reply =
            "🌐 <b>Horizon</b> is Stellar's REST API.\n\n" +
            "• /accounts/{id} — Account info\n" +
            "• /transactions — Submit/query txns\n\n" +
            "📚 https://developers.stellar.org/api/horizon";
        } else {
          // Unknown question — fall through to OpenAI if key is set
          const openaiKey = process.env.OPENAI_API_KEY;
          if (openaiKey && openaiKey !== "your_openai_api_key_here") {
            await bot.sendChatAction(chatId, "typing");
            reply = await answerStellarQuestion(text);
          } else {
            reply =
              "🤔 Try asking about:\n" +
              "• Stellar / XLM / Soroban\n" +
              "• Anchors & SEPs\n" +
              "• Freighter wallet\n\n" +
              "Or use <code>/balance ADDRESS</code> to check a balance.";
          }
        }

        if (reply) {
          await bot.sendMessage(chatId, reply, { parse_mode: "HTML" });
        }
      } catch (err: any) {
        await bot.sendMessage(
          chatId,
          `❌ Error: ${esc(err?.response?.data?.detail || err.message || "Try again")}`
        );
      }
    }
  });

  bot.onText(/\/balance(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id.toString();
    const address = match?.[1]?.trim();

    if (!address) {
      bot.sendMessage(
        chatId,
        "Usage: /balance <Stellar address>\nExample: /balance GABC..."
      );
      return;
    }

    try {
      const account = await horizon.loadAccount(address);
      const xlmBalance = account.balances.find(
        (b) => b.asset_type === "native" || (b as any).asset_code === "XLM"
      );
      const balanceStr =
        xlmBalance && "balance" in xlmBalance
          ? xlmBalance.balance
          : "0";

      bot.sendMessage(
        chatId,
        `<b>Balance</b> for <code>${esc(address.slice(0, 8))}...${esc(address.slice(-8))}</code>:\n` +
        `<b>${fmtXLM(balanceStr)} XLM</b>\n\n` +
        `🔗 <a href="https://stellar.expert/explorer/testnet/account/${esc(address)}">View on Explorer</a>`,
        { parse_mode: "HTML" }
      );
    } catch (err: any) {
      bot.sendMessage(
        chatId,
        `Error: ${err?.response?.data?.detail || err.message || "Failed to fetch balance"}`
      );
    }
  });

  console.log("Telegram Bot initialized");
}

async function sendNotification(
  chatId: string,
  message: string,
  options: { parseMode?: string; disableNotification?: boolean } = {}
): Promise<boolean> {
  await bot.sendMessage(chatId, message, {
    parse_mode: (options.parseMode as any) || undefined,
    disable_notification: options.disableNotification,
  });
  return true;
}

// Express API
const app = express();
app.use(cors(corsOptions()));
app.use(express.json({ limit: "1mb" }));
app.use(generalLimiter);

app.use((req, res, next) => {
  metrics.totalRequests++;
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.url}`);
  metrics.requestLog.push({ timestamp, method: req.method, path: req.url });
  // Keep only last 100 requests
  if (metrics.requestLog.length > 100) metrics.requestLog.shift();
  next();
});

// ─── Mount modular API routes ─────────────────────────────────────────────
mountRoutes(app, sendNotification);

// Legacy inline routes removed — all API endpoints now served from ./routes/

/**<b> REMOVED INLINE ROUTES — replaced by mountRoutes() above </b>**
app.post("/api/telegram/send", validate(schemas.sendMessage), async (req, res) => {
  try {
    const { chatId, message, parseMode, disableNotification } = req.body;
    console.log(`Sending message to ${chatId} with parseMode: ${parseMode}`);

    if (!chatId || !message) {
      return res
        .status(400)
        .json({ error: "chatId and message are required" });
    }

    const chatIdStr = String(chatId).trim();
    if (chatIdStr.startsWith("@")) {
      return res.status(400).json({
        error:
          "Use numeric Chat ID, not @username. Send /register to the bot to get your Chat ID.",
      });
    }

    const success = await sendNotification(chatIdStr, message, {
      parseMode,
      disableNotification,
    });

    if (success) {
      return res
        .status(200)
        .json({ success: true, message: "Notification sent" });
    }
    return res
      .status(500)
      .json({ success: false, error: "Failed to send" });
  } catch (error: any) {
    const tgDesc = error?.response?.body?.description || "";
    const friendlyMessage =
      tgDesc.includes("chat not found") || tgDesc.includes("chat_id")
        ? "Chat not found. Use your numeric Chat ID (send /register to the bot to get it), not @username."
        : error?.message || "Failed to send";
    return res.status(400).json({ success: false, error: friendlyMessage });
  }
});

// Stellar balance check (for workflow/API)
app.get("/api/stellar/balance/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const account = await horizon.loadAccount(address);
    const xlmBalance = account.balances.find(
      (b) => b.asset_type === "native"
    );
    const balance =
      xlmBalance && "balance" in xlmBalance ? xlmBalance.balance : "0";

    return res.json({ success: true, balance, address });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.response?.data?.detail || error.message,
    });
  }
});

// Session registration - called by frontend when workflow starts
app.post("/api/session/register", authLimiter, validate(schemas.sessionRegister), (req, res) => {
  try {
    const { chatId, features } = req.body;

    if (!chatId) {
      return res.status(400).json({ error: "chatId is required" });
    }

    const chatIdStr = String(chatId).trim();
    const featureList = Array.isArray(features) ? features : [];

    // Register or update session
    activeSessions.set(chatIdStr, {
      features: featureList,
      registeredAt: new Date(),
    });

    console.log(`Session registered for ${chatIdStr} with features:`, featureList);

    return res.json({
      success: true,
      chatId: chatIdStr,
      features: featureList,
      message: `Session registered with ${featureList.length} feature(s)`,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to register session",
    });
  }
});

// Get session info
app.get("/api/session/:chatId", (req, res) => {
  const { chatId } = req.params;
  const session = activeSessions.get(chatId);

  if (!session) {
    return res.status(404).json({
      success: false,
      error: "No active session for this chat",
    });
  }

  return res.json({
    success: true,
    chatId,
    ...session,
  });
});

// Clear session
app.delete("/api/session/:chatId", (req, res) => {
  const { chatId } = req.params;
  activeSessions.delete(chatId);

  return res.json({
    success: true,
    message: "Session cleared",
  });
});

// === TELEGRAM WALLET API ENDPOINTS ===

// Create wallet for a chat
app.post("/api/wallet/create", authLimiter, validate(schemas.createWallet), (req, res) => {
  try {
    const { chatId } = req.body;

    if (!chatId) {
      return res.status(400).json({ error: "chatId is required" });
    }

    const chatIdStr = String(chatId).trim();

    // Check if wallet already exists
    if (userWallets.has(chatIdStr)) {
      const wallet = userWallets.get(chatIdStr)!;
      return res.json({
        success: true,
        publicKey: wallet.publicKey,
        message: "Wallet already exists",
        isNew: false,
      });
    }

    // Create new wallet
    const keypair = Keypair.random();
    userWallets.set(chatIdStr, {
      publicKey: keypair.publicKey(),
      secretKey: keypair.secret(),
      createdAt: new Date(),
    });

    return res.json({
      success: true,
      publicKey: keypair.publicKey(),
      message: "Wallet created successfully",
      isNew: true,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to create wallet",
    });
  }
});

// Get wallet info
app.get("/api/wallet/:chatId", (req, res) => {
  const { chatId } = req.params;
  const wallet = userWallets.get(chatId);

  if (!wallet) {
    return res.status(404).json({
      success: false,
      error: "No wallet found for this chat",
    });
  }

  return res.json({
    success: true,
    publicKey: wallet.publicKey,
    createdAt: wallet.createdAt,
  });
});

// Get wallet balance (uses stored wallet address)
app.get("/api/wallet/:chatId/balance", async (req, res) => {
  try {
    const { chatId } = req.params;
    const wallet = userWallets.get(chatId);

    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: "No wallet found for this chat. Create one first.",
      });
    }

    try {
      const account = await horizon.loadAccount(wallet.publicKey);
      const xlmBalance = account.balances.find((b) => b.asset_type === "native");
      const balance = xlmBalance && "balance" in xlmBalance ? xlmBalance.balance : "0";

      const otherBalances = account.balances
        .filter((b) => b.asset_type !== "native" && "asset_code" in b)
        .map((b: any) => ({
          asset: b.asset_code,
          balance: b.balance,
          issuer: b.asset_issuer,
        }));

      return res.json({
        success: true,
        publicKey: wallet.publicKey,
        xlmBalance: balance,
        otherBalances,
        network: STELLAR_NETWORK,
      });
    } catch (err: any) {
      if (err?.response?.status === 404) {
        return res.json({
          success: true,
          publicKey: wallet.publicKey,
          xlmBalance: "0",
          otherBalances: [],
          network: STELLAR_NETWORK,
          message: "Account not funded yet",
        });
      }
      throw err;
    }
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to get balance",
    });
  }
});

// Fund wallet (testnet only)
app.post("/api/wallet/:chatId/fund", async (req, res) => {
  try {
    const { chatId } = req.params;
    const wallet = userWallets.get(chatId);

    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: "No wallet found for this chat",
      });
    }

    if (STELLAR_NETWORK !== "testnet") {
      return res.status(400).json({
        success: false,
        error: "Funding only available on testnet",
      });
    }

    const response = await fetch(
      `https://friendbot.stellar.org?addr=${wallet.publicKey}`
    );

    if (response.ok) {
      return res.json({
        success: true,
        publicKey: wallet.publicKey,
        message: "Wallet funded with 10,000 testnet XLM",
      });
    } else {
      return res.status(400).json({
        success: false,
        error: "Failed to fund wallet. It might already be funded.",
      });
    }
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to fund wallet",
    });
  }
});

// Send XLM from wallet
app.post("/api/wallet/:chatId/send", walletLimiter, validate(schemas.sendXLM), async (req, res) => {
  try {
    const { chatId } = req.params;
    const { destination, amount } = req.body;
    const wallet = userWallets.get(chatId);

    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: "No wallet found for this chat",
      });
    }

    if (!destination || !amount) {
      return res.status(400).json({
        success: false,
        error: "destination and amount are required",
      });
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid amount",
      });
    }

    // Load sender account
    const sourceKeypair = Keypair.fromSecret(wallet.secretKey);
    const sourceAccount = await horizon.loadAccount(wallet.publicKey);

    // Check if destination exists
    let destinationExists = true;
    try {
      await horizon.loadAccount(destination);
    } catch {
      destinationExists = false;
    }

    const networkPassphrase = STELLAR_NETWORK === "testnet"
      ? Networks.TESTNET
      : Networks.PUBLIC;

    let transaction;
    if (destinationExists) {
      transaction = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase,
      })
        .addOperation(
          Operation.payment({
            destination,
            asset: Asset.native(),
            amount: amountNum.toFixed(7),
          })
        )
        .setTimeout(30)
        .build();
    } else {
      if (amountNum < 1) {
        return res.status(400).json({
          success: false,
          error: "Minimum 1 XLM required to create new account",
        });
      }
      transaction = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase,
      })
        .addOperation(
          Operation.createAccount({
            destination,
            startingBalance: amountNum.toFixed(7),
          })
        )
        .setTimeout(30)
        .build();
    }

    transaction.sign(sourceKeypair);
    const result = await horizon.submitTransaction(transaction);

    // Record this workflow-triggered run on-chain (non-blocking).
    logRunOnChain(String(chatId), wallet.secretKey, "workflow-send", 1);

    return res.json({
      success: true,
      hash: result.hash,
      amount: amountNum,
      destination,
      explorerUrl: `https://stellar.expert/explorer/${STELLAR_NETWORK}/tx/${result.hash}`,
    });
  } catch (error: any) {
    const errorMsg = error?.response?.data?.extras?.result_codes
      ? JSON.stringify(error.response.data.extras.result_codes)
      : error.message || "Transaction failed";
    return res.status(500).json({
      success: false,
      error: errorMsg,
    });
  }
});

// === FREIGHTER WALLET API ENDPOINTS ===

// Register/Connect Freighter wallet for a chat
app.post("/api/freighter/connect", authLimiter, validate(schemas.freighterConnect), (req, res) => {
  try {
    const { chatId, publicKey, network } = req.body;

    if (!chatId || !publicKey) {
      return res.status(400).json({
        success: false,
        error: "chatId and publicKey are required"
      });
    }

    const chatIdStr = String(chatId).trim();

    // Store Freighter wallet
    freighterWallets.set(chatIdStr, {
      publicKey,
      network: network || "testnet",
      connectedAt: new Date(),
    });

    console.log(`Freighter wallet connected for ${chatIdStr}: ${publicKey}`);

    return res.json({
      success: true,
      publicKey,
      network: network || "testnet",
      message: "Freighter wallet connected successfully",
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to connect Freighter wallet",
    });
  }
});

// Get Freighter wallet info
app.get("/api/freighter/:chatId", (req, res) => {
  const { chatId } = req.params;
  const wallet = freighterWallets.get(chatId);

  if (!wallet) {
    return res.status(404).json({
      success: false,
      error: "No Freighter wallet connected for this chat",
    });
  }

  return res.json({
    success: true,
    publicKey: wallet.publicKey,
    network: wallet.network,
    connectedAt: wallet.connectedAt,
  });
});

// Get Freighter wallet balance
app.get("/api/freighter/:chatId/balance", async (req, res) => {
  try {
    const { chatId } = req.params;
    const wallet = freighterWallets.get(chatId);

    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: "No Freighter wallet connected. Connect via StellrFlow workflow.",
      });
    }

    try {
      const account = await horizon.loadAccount(wallet.publicKey);
      const xlmBalance = account.balances.find((b) => b.asset_type === "native");
      const balance = xlmBalance && "balance" in xlmBalance ? xlmBalance.balance : "0";

      const otherBalances = account.balances
        .filter((b) => b.asset_type !== "native" && "asset_code" in b)
        .map((b: any) => ({
          asset: b.asset_code,
          balance: b.balance,
          issuer: b.asset_issuer,
        }));

      return res.json({
        success: true,
        publicKey: wallet.publicKey,
        xlmBalance: balance,
        otherBalances,
        network: wallet.network,
      });
    } catch (err: any) {
      if (err?.response?.status === 404) {
        return res.json({
          success: true,
          publicKey: wallet.publicKey,
          xlmBalance: "0",
          otherBalances: [],
          network: wallet.network,
          message: "Account not funded yet",
        });
      }
      throw err;
    }
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to get balance",
    });
  }
});

// Disconnect Freighter wallet
app.delete("/api/freighter/:chatId", (req, res) => {
  const { chatId } = req.params;

  if (!freighterWallets.has(chatId)) {
    return res.status(404).json({
      success: false,
      error: "No Freighter wallet connected",
    });
  }

  freighterWallets.delete(chatId);

  return res.json({
    success: true,
    message: "Freighter wallet disconnected",
  });
});

// === TRANSACTION API ENDPOINTS (for Freighter signing) ===

// Build unsigned transaction XDR (for Freighter to sign)
app.post("/api/transaction/build", walletLimiter, validate(schemas.buildTransaction), async (req, res) => {
  try {
    const { sourceAddress, destination, amount, network } = req.body;

    if (!sourceAddress || !destination || !amount) {
      return res.status(400).json({
        success: false,
        error: "sourceAddress, destination, and amount are required",
      });
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid amount",
      });
    }

    // Load source account
    const sourceAccount = await horizon.loadAccount(sourceAddress);

    // Check if destination exists
    let destinationExists = true;
    try {
      await horizon.loadAccount(destination);
    } catch {
      destinationExists = false;
    }

    const networkPassphrase = (network || STELLAR_NETWORK) === "testnet"
      ? Networks.TESTNET
      : Networks.PUBLIC;

    let transaction;
    if (destinationExists) {
      // Regular payment
      transaction = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase,
      })
        .addOperation(
          Operation.payment({
            destination,
            asset: Asset.native(),
            amount: amountNum.toFixed(7),
          })
        )
        .setTimeout(300) // 5 minutes for user to sign
        .build();
    } else {
      // Create account operation
      if (amountNum < 1) {
        return res.status(400).json({
          success: false,
          error: "Minimum 1 XLM required to create new account",
        });
      }
      transaction = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase,
      })
        .addOperation(
          Operation.createAccount({
            destination,
            startingBalance: amountNum.toFixed(7),
          })
        )
        .setTimeout(300)
        .build();
    }

    // Return unsigned XDR for Freighter to sign
    return res.json({
      success: true,
      xdr: transaction.toXDR(),
      network: network || STELLAR_NETWORK,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to build transaction",
    });
  }
});

// Submit signed transaction
app.post("/api/transaction/submit", walletLimiter, validate(schemas.submitTransaction), async (req, res) => {
  try {
    const { signedXdr, chatId } = req.body;

    if (!signedXdr) {
      return res.status(400).json({
        success: false,
        error: "signedXdr is required",
      });
    }

    // Submit the signed transaction
    const result = await horizon.submitTransaction(
      TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET)
    );

    return res.json({
      success: true,
      hash: result.hash,
      explorerUrl: `https://stellar.expert/explorer/${STELLAR_NETWORK}/tx/${result.hash}`,
    });
  } catch (error: any) {
    const errorMsg = error?.response?.data?.extras?.result_codes
      ? JSON.stringify(error.response.data.extras.result_codes)
      : error.message || "Transaction submission failed";
    return res.status(500).json({
      success: false,
      error: errorMsg,
    });
  }
});

// === ANCHOR API ENDPOINTS ===
// These let the frontend workflow builder trigger on/off ramp flows via REST.

// POST /api/anchor/deposit — Trigger deposit (on-ramp)
app.post("/api/anchor/deposit", walletLimiter, validate(schemas.anchorDeposit), async (req, res) => {
  try {
    const { chatId, amount, currency } = req.body;
    if (!chatId || !amount) {
      return res.status(400).json({ success: false, error: "chatId and amount are required" });
    }

    let wallet = freighterWallets.get(String(chatId)) || userWallets.get(String(chatId));

    // Auto-create wallet if none exists
    if (!wallet) {
      const keypair = Keypair.random();
      const newWallet = {
        publicKey: keypair.publicKey(),
        secretKey: keypair.secret(),
        createdAt: new Date(),
      };
      userWallets.set(String(chatId), newWallet);
      wallet = newWallet;
      console.log(`Auto-created wallet for anchor deposit: ${chatId}`);
    }

    // Pass treasury secret for real XLM transfer (or undefined for Friendbot fallback)
    const sourceSecret = ANCHOR_TREASURY_SECRET || undefined;
    const result = await quickDeposit(String(chatId), parseFloat(amount), currency || 'USD', wallet.publicKey, sourceSecret);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/anchor/withdraw — Trigger withdrawal (off-ramp)
app.post("/api/anchor/withdraw", walletLimiter, validate(schemas.anchorWithdraw), async (req, res) => {
  try {
    const { chatId, xlmAmount, currency } = req.body;
    if (!chatId || !xlmAmount) {
      return res.status(400).json({ success: false, error: "chatId and xlmAmount are required" });
    }

    let wallet = freighterWallets.get(String(chatId)) || userWallets.get(String(chatId));

    // Auto-create wallet if none exists
    if (!wallet) {
      const keypair = Keypair.random();
      const newWallet = {
        publicKey: keypair.publicKey(),
        secretKey: keypair.secret(),
        createdAt: new Date(),
      };
      userWallets.set(String(chatId), newWallet);
      wallet = newWallet;
      console.log(`Auto-created wallet for anchor withdrawal: ${chatId}`);
    }

    const telegramWallet = userWallets.get(String(chatId));
    const secret = telegramWallet?.secretKey;
    const result = await quickWithdrawal(String(chatId), parseFloat(xlmAmount), currency || 'USD', wallet.publicKey, secret);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/anchor/rates — Get current exchange rates
app.get("/api/anchor/rates", (_req, res) => {
  const currencies = getSupportedCurrencies();
  const rates = currencies.map((c: string) => {
    const { rate } = getExchangeRate(c);
    return { currency: c, fiatToXLM: rate, xlmToFiat: Math.round((1 / rate) * 100) / 100 };
  });
  return res.json({ success: true, rates });
});

// GET /api/anchor/history/:chatId — Get deposit/withdrawal history
app.get("/api/anchor/history/:chatId", (req, res) => {
  const { chatId } = req.params;
  const deposits = getUserDeposits(chatId);
  const withdrawals = getUserWithdrawals(chatId);
  return res.json({ success: true, deposits, withdrawals });
});

app.get("/api/telegram/health", (_req, res) => {
  const uptime = Math.floor((Date.now() - metrics.startedAt.getTime()) / 1000);
  res.json({
    status: "ok",
    service: "stellrflow-telegram-stellar",
    network: STELLAR_NETWORK,
    uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`,
    activeSessions: activeSessions.size,
    freighterWallets: freighterWallets.size,
    telegramWallets: userWallets.size,
    totalRequests: metrics.totalRequests,
    timestamp: new Date().toISOString(),
  });
});

// ============ METRICS & MONITORING ============

app.get("/api/metrics", requireApiKey, (_req, res) => {
  const uptime = Math.floor((Date.now() - metrics.startedAt.getTime()) / 1000);
  res.json({
    success: true,
    uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`,
    users: {
      totalTelegramWallets: userWallets.size,
      totalFreighterWallets: freighterWallets.size,
      totalUsers: userWallets.size + freighterWallets.size,
      dailyActiveUsers: metrics.dailyActiveUsers.size,
    },
    activity: {
      totalRequests: metrics.totalRequests,
      totalCommands: metrics.totalCommands,
      totalWalletsCreated: metrics.totalWalletsCreated,
      totalTransactions: metrics.totalTransactions,
      commandBreakdown: metrics.commandCounts,
    },
    system: {
      network: STELLAR_NETWORK,
      activeSessions: activeSessions.size,
      autoPayActive: autoPaySchedules.size,
      startedAt: metrics.startedAt.toISOString(),
    },
    recentRequests: metrics.requestLog.slice(-20),
  });
});

// GET /api/users/addresses — List all wallet addresses (admin only)
app.get("/api/users/addresses", requireApiKey, (_req, res) => {
  const addresses: { type: string; chatId: string; publicKey: string; createdAt: string }[] = [];

  userWallets.forEach((wallet, chatId) => {
    addresses.push({
      type: "telegram",
      chatId,
      publicKey: wallet.publicKey,
      createdAt: wallet.createdAt.toISOString(),
    });
  });

  freighterWallets.forEach((wallet, chatId) => {
    addresses.push({
      type: "freighter",
      chatId,
      publicKey: wallet.publicKey,
      createdAt: wallet.connectedAt.toISOString(),
    });
  });

  res.json({
    success: true,
    total: addresses.length,
    addresses,
  });
});

// POST /api/transaction/fee-bump — Fee sponsorship (gasless tx)
app.post("/api/transaction/fee-bump", walletLimiter, validate(schemas.feeBump), async (req, res) => {
  try {
    const { innerTxXdr } = req.body;
    if (!innerTxXdr) {
      return res.status(400).json({ success: false, error: "innerTxXdr required" });
    }

    if (!STELLAR_SECRET_KEY) {
      return res.status(500).json({ success: false, error: "Fee sponsor key not configured" });
    }

    const sponsorKeypair = Keypair.fromSecret(STELLAR_SECRET_KEY);
    const networkPassphrase = STELLAR_NETWORK === "testnet" ? Networks.TESTNET : Networks.PUBLIC;

    // Build fee bump transaction
    const innerTx = TransactionBuilder.fromXDR(innerTxXdr, networkPassphrase);
    const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
      sponsorKeypair,
      BASE_FEE,
      innerTx as any,
      networkPassphrase
    );
    feeBumpTx.sign(sponsorKeypair);

    // Submit
    const result = await horizon.submitTransaction(feeBumpTx);
    metrics.totalTransactions++;

    res.json({
      success: true,
      hash: (result as any).hash,
      feeSponsor: sponsorKeypair.publicKey(),
      message: "Transaction fee sponsored by StellrFlow",
    });
  } catch (err: any) {
    console.error("Fee bump error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============ AUTOPAY SCHEDULER (In-Memory for Hackathon) ============

interface AutoPaySchedule {
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

const autoPaySchedules = new Map<string, AutoPaySchedule>();
let scheduleCounter = 1;

// POST /api/autopay/create — Create scheduled payment
app.post("/api/autopay/create", walletLimiter, validate(schemas.createAutoPay), (req, res) => {
  try {
    const { chatId, destination, amount, interval, duration } = req.body;

    if (!chatId || !destination || !amount) {
      return res.status(400).json({
        success: false,
        error: "chatId, destination, and amount are required"
      });
    }

    const wallet = freighterWallets.get(String(chatId)) || userWallets.get(String(chatId));
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: "No wallet connected. Connect a wallet first."
      });
    }

    const scheduleId = `AP-${Date.now()}-${scheduleCounter++}`;
    const now = new Date();

    // Calculate next payment based on interval
    const nextPayment = new Date(now);
    if (interval === "daily") {
      nextPayment.setDate(nextPayment.getDate() + 1);
    } else if (interval === "weekly") {
      nextPayment.setDate(nextPayment.getDate() + 7);
    } else if (interval === "monthly") {
      nextPayment.setMonth(nextPayment.getMonth() + 1);
    } else {
      nextPayment.setHours(nextPayment.getHours() + 1);
    }

    const schedule: AutoPaySchedule = {
      scheduleId,
      chatId: String(chatId),
      destination,
      amount: parseFloat(amount),
      interval: interval || "daily",
      duration: parseInt(duration) || 30,
      createdAt: now,
      nextPayment,
      isActive: true,
    };

    autoPaySchedules.set(scheduleId, schedule);

    console.log(`AutoPay schedule created: ${scheduleId} for ${chatId}`);

    return res.json({
      success: true,
      scheduleId,
      destination,
      amount: schedule.amount,
      interval: schedule.interval,
      duration: schedule.duration,
      nextPayment: nextPayment.toISOString(),
      message: "AutoPay schedule created successfully",
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/autopay/:chatId — Get user's schedules
app.get("/api/autopay/:chatId", (req, res) => {
  const { chatId } = req.params;
  const schedules = Array.from(autoPaySchedules.values())
    .filter(s => s.chatId === chatId);
  return res.json({ success: true, schedules });
});

// DELETE /api/autopay/:scheduleId — Cancel a schedule
app.delete("/api/autopay/:scheduleId", (req, res) => {
  const { scheduleId } = req.params;
  const schedule = autoPaySchedules.get(scheduleId);

  if (!schedule) {
    return res.status(404).json({ success: false, error: "Schedule not found" });
  }

  schedule.isActive = false;
  autoPaySchedules.delete(scheduleId);

  return res.json({ success: true, message: "Schedule cancelled" });
});

// ============ MULTISIG (In-Memory for Hackathon) ============

interface MultisigConfig {
  multisigId: string;
  chatId: string;
  threshold: number;
  signers: string[];
  timeout: number;
  createdAt: Date;
  isActive: boolean;
}

interface PendingApproval {
  txId: string;
  multisigId: string;
  approvals: string[];
  createdAt: Date;
  expiresAt: Date;
}

const multisigConfigs = new Map<string, MultisigConfig>();
const pendingApprovals = new Map<string, PendingApproval>();
let multisigCounter = 1;

// POST /api/multisig/create — Configure multisig
app.post("/api/multisig/create", walletLimiter, validate(schemas.createMultisig), (req, res) => {
  try {
    const { chatId, threshold, signers, timeout } = req.body;

    if (!chatId || !threshold) {
      return res.status(400).json({
        success: false,
        error: "chatId and threshold are required"
      });
    }

    const signerList = signers || [];
    if (signerList.length < threshold) {
      return res.status(400).json({
        success: false,
        error: `Need at least ${threshold} signers, got ${signerList.length}`
      });
    }

    const multisigId = `MS-${Date.now()}-${multisigCounter++}`;
    const now = new Date();

    const config: MultisigConfig = {
      multisigId,
      chatId: String(chatId),
      threshold: parseInt(threshold),
      signers: signerList,
      timeout: parseInt(timeout) || 24,
      createdAt: now,
      isActive: true,
    };

    multisigConfigs.set(multisigId, config);

    console.log(`Multisig configured: ${multisigId} for ${chatId} (${threshold}/${signerList.length})`);

    return res.json({
      success: true,
      multisigId,
      threshold: config.threshold,
      signerCount: signerList.length,
      timeout: config.timeout,
      message: "Multisig configured successfully",
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/multisig/:chatId — Get multisig config
app.get("/api/multisig/:chatId", (req, res) => {
  const { chatId } = req.params;
  const configs = Array.from(multisigConfigs.values())
    .filter(c => c.chatId === chatId);
  return res.json({ success: true, configs });
});
****/

initBot();

// Register command autocomplete list so Telegram shows hints when user types "/"
bot.setMyCommands([
  { command: "start",        description: "Welcome & wallet setup" },
  { command: "createwallet", description: "Create an in-bot Stellar wallet" },
  { command: "fundwallet",   description: "Get 10,000 testnet XLM via Friendbot" },
  { command: "mybalance",    description: "Check your wallet balance" },
  { command: "mywallet",     description: "Show your wallet address" },
  { command: "qrcode",       description: "Get wallet address as QR code" },
  { command: "send",         description: "Send XLM — /send ADDR AMOUNT [memo TEXT]" },
  { command: "txhistory",    description: "On-chain transaction history" },
  { command: "contacts",     description: "Address book" },
  { command: "addcontact",   description: "Save a contact — /addcontact NAME ADDRESS" },
  { command: "watchbalance", description: "Notify when balance changes" },
  { command: "stopwatch",    description: "Stop balance notifications" },
  { command: "exportwallet", description: "Backup your wallet key (DM only)" },
  { command: "balance",      description: "Check any Stellar address" },
  { command: "rates",        description: "Current exchange rates" },
  { command: "addfunds",     description: "Deposit fiat → XLM" },
  { command: "withdraw",     description: "Withdraw XLM → fiat" },
  { command: "status",       description: "Your connection status" },
  { command: "disconnect",   description: "Disconnect wallet" },
  { command: "help",         description: "Full command list" },
]).catch((e: any) => console.warn("setMyCommands:", e.message));

// ─── Startup Health Check ────────────────────────────────────────────────────

async function checkHorizonConnectivity(): Promise<void> {
  try {
    const response = await fetch(`${HORIZON_URL}/`);
    if (response.ok) {
      console.log(`Horizon connectivity: OK (${HORIZON_URL})`);
    } else {
      console.warn(`Horizon responded with status ${response.status} — some features may not work`);
    }
  } catch (err) {
    console.error(`WARNING: Cannot reach Horizon at ${HORIZON_URL} — blockchain operations will fail`);
    console.error("  Ensure the Stellar network is accessible from this environment");
  }
}

async function startup() {
  await checkHorizonConnectivity();

  app.listen(PORT, () => {
    console.log(`StellrFlow Telegram Bot API running on port ${PORT}`);
    console.log(`Stellar network: ${STELLAR_NETWORK}`);
    console.log(`Routes: modular (./routes)`);
  });
}

startup();
