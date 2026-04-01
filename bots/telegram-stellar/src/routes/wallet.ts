/**
 * Wallet API routes — Telegram wallet CRUD, balance, send, fund.
 */

import { Router } from "express";
import { Keypair, TransactionBuilder, Operation, Asset, BASE_FEE, Networks } from "@stellar/stellar-sdk";
import { walletLimiter, authLimiter } from "../middleware/security.js";
import { validate, schemas } from "../middleware/validation.js";
import { withRetry, isRetryableHorizonError } from "../utils/retry.js";
import {
  userWallets,
  horizon,
  STELLAR_NETWORK,
  metrics,
  saveWallets,
  accountExists,
} from "../state.js";

const router = Router();

// Create wallet
router.post("/create", authLimiter, validate(schemas.createWallet), (req, res) => {
  try {
    const { chatId } = req.body;
    const chatIdStr = String(chatId).trim();

    if (userWallets.has(chatIdStr)) {
      const wallet = userWallets.get(chatIdStr)!;
      return res.json({ success: true, publicKey: wallet.publicKey, message: "Wallet already exists", isNew: false });
    }

    const keypair = Keypair.random();
    metrics.totalWalletsCreated++;
    userWallets.set(chatIdStr, {
      publicKey: keypair.publicKey(),
      secretKey: keypair.secret(),
      createdAt: new Date(),
    });
    saveWallets();

    return res.json({ success: true, publicKey: keypair.publicKey(), message: "Wallet created successfully", isNew: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to create wallet";
    return res.status(500).json({ success: false, error: msg });
  }
});

// Get wallet info
router.get("/:chatId", (req, res) => {
  const wallet = userWallets.get(req.params.chatId);
  if (!wallet) {
    return res.status(404).json({ success: false, error: "No wallet found for this chat" });
  }
  return res.json({ success: true, publicKey: wallet.publicKey, createdAt: wallet.createdAt });
});

// Get wallet balance
router.get("/:chatId/balance", async (req, res) => {
  try {
    const wallet = userWallets.get(req.params.chatId);
    if (!wallet) {
      return res.status(404).json({ success: false, error: "No wallet found for this chat. Create one first." });
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

      return res.json({ success: true, publicKey: wallet.publicKey, xlmBalance: balance, otherBalances, network: STELLAR_NETWORK });
    } catch (err: unknown) {
      const status = (err as Record<string, Record<string, number>>)?.response?.status;
      if (status === 404) {
        return res.json({ success: true, publicKey: wallet.publicKey, xlmBalance: "0", otherBalances: [], network: STELLAR_NETWORK, message: "Account not funded yet" });
      }
      throw err;
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to get balance";
    return res.status(500).json({ success: false, error: msg });
  }
});

// Fund wallet (testnet only)
router.post("/:chatId/fund", async (req, res) => {
  try {
    const wallet = userWallets.get(req.params.chatId);
    if (!wallet) {
      return res.status(404).json({ success: false, error: "No wallet found for this chat" });
    }
    if (STELLAR_NETWORK !== "testnet") {
      return res.status(400).json({ success: false, error: "Funding only available on testnet" });
    }

    const response = await withRetry(
      () => fetch(`https://friendbot.stellar.org?addr=${wallet.publicKey}`),
      { maxAttempts: 2 }
    );

    if (response.ok) {
      return res.json({ success: true, publicKey: wallet.publicKey, message: "Wallet funded with 10,000 testnet XLM" });
    }
    return res.status(400).json({ success: false, error: "Failed to fund wallet. It might already be funded." });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fund wallet";
    return res.status(500).json({ success: false, error: msg });
  }
});

// Send XLM from wallet
router.post("/:chatId/send", walletLimiter, validate(schemas.sendXLM), async (req, res) => {
  try {
    const { destination, amount } = req.body;
    const wallet = userWallets.get(req.params.chatId);

    if (!wallet) {
      return res.status(404).json({ success: false, error: "No wallet found for this chat" });
    }

    const amountNum = parseFloat(amount);
    const sourceKeypair = Keypair.fromSecret(wallet.secretKey);
    const sourceAccount = await withRetry(
      () => horizon.loadAccount(wallet.publicKey),
      { retryIf: isRetryableHorizonError }
    );

    const destinationExists = await accountExists(destination);
    const networkPassphrase = STELLAR_NETWORK === "testnet" ? Networks.TESTNET : Networks.PUBLIC;

    let transaction;
    if (destinationExists) {
      transaction = new TransactionBuilder(sourceAccount, { fee: BASE_FEE, networkPassphrase })
        .addOperation(Operation.payment({ destination, asset: Asset.native(), amount: amountNum.toFixed(7) }))
        .setTimeout(30)
        .build();
    } else {
      if (amountNum < 1) {
        return res.status(400).json({ success: false, error: "Minimum 1 XLM required to create new account" });
      }
      transaction = new TransactionBuilder(sourceAccount, { fee: BASE_FEE, networkPassphrase })
        .addOperation(Operation.createAccount({ destination, startingBalance: amountNum.toFixed(7) }))
        .setTimeout(30)
        .build();
    }

    transaction.sign(sourceKeypair);
    const result = await withRetry(
      () => horizon.submitTransaction(transaction),
      { maxAttempts: 2, retryIf: isRetryableHorizonError }
    );
    metrics.totalTransactions++;

    return res.json({
      success: true,
      hash: result.hash,
      amount: amountNum,
      destination,
      explorerUrl: `https://stellar.expert/explorer/${STELLAR_NETWORK}/tx/${result.hash}`,
    });
  } catch (error: unknown) {
    const err = error as Record<string, Record<string, Record<string, unknown>>>;
    const errorMsg = err?.response?.data?.extras
      ? JSON.stringify((err.response.data.extras as Record<string, unknown>).result_codes)
      : error instanceof Error ? error.message : "Transaction failed";
    return res.status(500).json({ success: false, error: errorMsg });
  }
});

export default router;
