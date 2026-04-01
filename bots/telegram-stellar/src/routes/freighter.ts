/**
 * Freighter wallet API routes — connect, get, balance, disconnect.
 */

import { Router } from "express";
import { authLimiter } from "../middleware/security.js";
import { validate, schemas } from "../middleware/validation.js";
import { withRetry, isRetryableHorizonError } from "../utils/retry.js";
import {
  freighterWallets,
  horizon,
  STELLAR_NETWORK,
  saveWallets,
} from "../state.js";

const router = Router();

// Connect Freighter wallet
router.post("/connect", authLimiter, validate(schemas.freighterConnect), (req, res) => {
  try {
    const { chatId, publicKey, network } = req.body;
    const chatIdStr = String(chatId).trim();

    freighterWallets.set(chatIdStr, {
      publicKey,
      network: network || "testnet",
      connectedAt: new Date(),
    });
    saveWallets();

    console.log(`Freighter wallet connected for ${chatIdStr}: ${publicKey}`);
    return res.json({ success: true, publicKey, network: network || "testnet", message: "Freighter wallet connected successfully" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to connect Freighter wallet";
    return res.status(500).json({ success: false, error: msg });
  }
});

// Get Freighter wallet info
router.get("/:chatId", (req, res) => {
  const wallet = freighterWallets.get(req.params.chatId);
  if (!wallet) {
    return res.status(404).json({ success: false, error: "No Freighter wallet connected for this chat" });
  }
  return res.json({ success: true, publicKey: wallet.publicKey, network: wallet.network, connectedAt: wallet.connectedAt });
});

// Get Freighter wallet balance
router.get("/:chatId/balance", async (req, res) => {
  try {
    const wallet = freighterWallets.get(req.params.chatId);
    if (!wallet) {
      return res.status(404).json({ success: false, error: "No Freighter wallet connected. Connect via StellrFlow workflow." });
    }

    try {
      const account = await withRetry(
        () => horizon.loadAccount(wallet.publicKey),
        { retryIf: isRetryableHorizonError }
      );
      const xlmBalance = account.balances.find((b) => b.asset_type === "native");
      const balance = xlmBalance && "balance" in xlmBalance ? xlmBalance.balance : "0";
      const otherBalances = account.balances
        .filter((b) => b.asset_type !== "native" && "asset_code" in b)
        .map((b) => ({
          asset: "asset_code" in b ? b.asset_code : "",
          balance: b.balance,
          issuer: "asset_issuer" in b ? b.asset_issuer : "",
        }));

      return res.json({ success: true, publicKey: wallet.publicKey, xlmBalance: balance, otherBalances, network: wallet.network });
    } catch (err: unknown) {
      const status = (err as Record<string, Record<string, number>>)?.response?.status;
      if (status === 404) {
        return res.json({ success: true, publicKey: wallet.publicKey, xlmBalance: "0", otherBalances: [], network: wallet.network, message: "Account not funded yet" });
      }
      throw err;
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to get balance";
    return res.status(500).json({ success: false, error: msg });
  }
});

// Disconnect Freighter wallet
router.delete("/:chatId", (req, res) => {
  if (!freighterWallets.has(req.params.chatId)) {
    return res.status(404).json({ success: false, error: "No Freighter wallet connected" });
  }
  freighterWallets.delete(req.params.chatId);
  saveWallets();
  return res.json({ success: true, message: "Freighter wallet disconnected" });
});

export default router;
