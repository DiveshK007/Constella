/**
 * Anchor API routes — deposit (on-ramp), withdraw (off-ramp), rates, history.
 */

import { Router } from "express";
import { Keypair } from "@stellar/stellar-sdk";
import { walletLimiter } from "../middleware/security.js";
import { validate, schemas } from "../middleware/validation.js";
import {
  userWallets,
  freighterWallets,
  ANCHOR_TREASURY_SECRET,
  saveWallets,
} from "../state.js";
import {
  quickDeposit,
  quickWithdrawal,
  getSupportedCurrencies,
  getExchangeRate,
  getUserDeposits,
  getUserWithdrawals,
} from "../anchor/index.js";

const router = Router();

// POST /deposit — Trigger deposit (on-ramp)
router.post("/deposit", walletLimiter, validate(schemas.anchorDeposit), async (req, res) => {
  try {
    const { chatId, amount, currency } = req.body;
    let wallet = freighterWallets.get(String(chatId)) || userWallets.get(String(chatId));

    if (!wallet) {
      const keypair = Keypair.random();
      const newWallet = { publicKey: keypair.publicKey(), secretKey: keypair.secret(), createdAt: new Date() };
      userWallets.set(String(chatId), newWallet);
      wallet = newWallet;
      saveWallets();
    }

    const sourceSecret = ANCHOR_TREASURY_SECRET || undefined;
    const result = await quickDeposit(String(chatId), parseFloat(amount), currency || "USD", wallet.publicKey, sourceSecret);
    return res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Deposit failed";
    return res.status(500).json({ success: false, error: msg });
  }
});

// POST /withdraw — Trigger withdrawal (off-ramp)
router.post("/withdraw", walletLimiter, validate(schemas.anchorWithdraw), async (req, res) => {
  try {
    const { chatId, xlmAmount, currency } = req.body;
    let wallet = freighterWallets.get(String(chatId)) || userWallets.get(String(chatId));

    if (!wallet) {
      const keypair = Keypair.random();
      const newWallet = { publicKey: keypair.publicKey(), secretKey: keypair.secret(), createdAt: new Date() };
      userWallets.set(String(chatId), newWallet);
      wallet = newWallet;
      saveWallets();
    }

    const telegramWallet = userWallets.get(String(chatId));
    const secret = telegramWallet?.secretKey;
    const result = await quickWithdrawal(String(chatId), parseFloat(xlmAmount), currency || "USD", wallet.publicKey, secret);
    return res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Withdrawal failed";
    return res.status(500).json({ success: false, error: msg });
  }
});

// GET /rates — Exchange rates
router.get("/rates", (_req, res) => {
  const currencies = getSupportedCurrencies();
  const rates = currencies.map((c: string) => {
    const { rate } = getExchangeRate(c);
    return { currency: c, fiatToXLM: rate, xlmToFiat: Math.round((1 / rate) * 100) / 100 };
  });
  return res.json({ success: true, rates });
});

// GET /history/:chatId — Deposit/withdrawal history
router.get("/history/:chatId", (req, res) => {
  const deposits = getUserDeposits(req.params.chatId);
  const withdrawals = getUserWithdrawals(req.params.chatId);
  return res.json({ success: true, deposits, withdrawals });
});

export default router;
