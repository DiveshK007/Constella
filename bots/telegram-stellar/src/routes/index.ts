/**
 * Route index — mounts all API route modules onto the Express app.
 */

import type { Express } from "express";
import { validate, schemas } from "../middleware/validation.js";
import { withRetry, isRetryableHorizonError } from "../utils/retry.js";
import { horizon, metrics } from "../state.js";

import walletRoutes from "./wallet.js";
import freighterRoutes from "./freighter.js";
import transactionRoutes from "./transaction.js";
import anchorRoutes from "./anchor.js";
import sessionRoutes from "./session.js";
import adminRoutes from "./admin.js";
import autopayRoutes from "./autopay.js";
import multisigRoutes from "./multisig.js";
import contractRoutes from "./contract.js";

export function mountRoutes(app: Express, sendNotification: (chatId: string, message: string, opts?: { parseMode?: string; disableNotification?: boolean }) => Promise<boolean>) {
  // ─── Telegram messaging ─────────────────────────────────────────────
  app.post("/api/telegram/send", validate(schemas.sendMessage), async (req, res) => {
    try {
      const { chatId, message, parseMode, disableNotification } = req.body;
      const chatIdStr = String(chatId).trim();
      if (chatIdStr.startsWith("@")) {
        return res.status(400).json({ error: "Use numeric Chat ID, not @username. Send /register to the bot to get your Chat ID." });
      }

      const success = await sendNotification(chatIdStr, message, { parseMode, disableNotification });
      if (success) {
        return res.status(200).json({ success: true, message: "Notification sent" });
      }
      return res.status(500).json({ success: false, error: "Failed to send" });
    } catch (error: unknown) {
      const err = error as Record<string, Record<string, Record<string, string>>>;
      const tgDesc = err?.response?.body?.description || "";
      const friendlyMessage =
        tgDesc.includes("chat not found") || tgDesc.includes("chat_id")
          ? "Chat not found. Use your numeric Chat ID (send /register to the bot to get it), not @username."
          : error instanceof Error ? error.message : "Failed to send";
      return res.status(400).json({ success: false, error: friendlyMessage });
    }
  });

  // ─── Stellar balance (standalone, outside wallet context) ───────────
  app.get("/api/stellar/balance/:address", async (req, res) => {
    try {
      const account = await withRetry(
        () => horizon.loadAccount(req.params.address),
        { retryIf: isRetryableHorizonError }
      );
      const xlmBalance = account.balances.find((b) => b.asset_type === "native");
      const balance = xlmBalance && "balance" in xlmBalance ? xlmBalance.balance : "0";
      return res.json({ success: true, balance, address: req.params.address });
    } catch (error: unknown) {
      const err = error as Record<string, Record<string, Record<string, string>>>;
      const msg = err?.response?.data?.detail || (error instanceof Error ? error.message : "Unknown error");
      return res.status(400).json({ success: false, error: msg });
    }
  });

  // ─── Health check (public) ──────────────────────────────────────────
  app.use("/api/telegram", adminRoutes);

  // ─── Mount route modules ────────────────────────────────────────────
  app.use("/api/session", sessionRoutes);
  app.use("/api/wallet", walletRoutes);
  app.use("/api/freighter", freighterRoutes);
  app.use("/api/transaction", transactionRoutes);
  app.use("/api/anchor", anchorRoutes);
  app.use("/api/autopay", autopayRoutes);
  app.use("/api/multisig", multisigRoutes);
  app.use("/api/contract", contractRoutes);
  app.use("/api", adminRoutes);
}
