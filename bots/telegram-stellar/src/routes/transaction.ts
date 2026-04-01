/**
 * Transaction API routes — build, submit, fee-bump.
 */

import { Router } from "express";
import { TransactionBuilder, Operation, Asset, BASE_FEE, Networks, Keypair } from "@stellar/stellar-sdk";
import { walletLimiter } from "../middleware/security.js";
import { validate, schemas } from "../middleware/validation.js";
import { withRetry, isRetryableHorizonError } from "../utils/retry.js";
import {
  horizon,
  STELLAR_NETWORK,
  STELLAR_SECRET_KEY,
  metrics,
  accountExists,
} from "../state.js";

const router = Router();

// Build unsigned transaction XDR (for Freighter to sign)
router.post("/build", walletLimiter, validate(schemas.buildTransaction), async (req, res) => {
  try {
    const { sourceAddress, destination, amount, network } = req.body;
    const amountNum = parseFloat(amount);

    const sourceAccount = await withRetry(
      () => horizon.loadAccount(sourceAddress),
      { retryIf: isRetryableHorizonError }
    );

    const destinationExists = await accountExists(destination);
    const networkPassphrase = (network || STELLAR_NETWORK) === "testnet" ? Networks.TESTNET : Networks.PUBLIC;

    let transaction;
    if (destinationExists) {
      transaction = new TransactionBuilder(sourceAccount, { fee: BASE_FEE, networkPassphrase })
        .addOperation(Operation.payment({ destination, asset: Asset.native(), amount: amountNum.toFixed(7) }))
        .setTimeout(300)
        .build();
    } else {
      if (amountNum < 1) {
        return res.status(400).json({ success: false, error: "Minimum 1 XLM required to create new account" });
      }
      transaction = new TransactionBuilder(sourceAccount, { fee: BASE_FEE, networkPassphrase })
        .addOperation(Operation.createAccount({ destination, startingBalance: amountNum.toFixed(7) }))
        .setTimeout(300)
        .build();
    }

    return res.json({ success: true, xdr: transaction.toXDR(), network: network || STELLAR_NETWORK });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to build transaction";
    return res.status(500).json({ success: false, error: msg });
  }
});

// Submit signed transaction
router.post("/submit", walletLimiter, validate(schemas.submitTransaction), async (req, res) => {
  try {
    const { signedXdr } = req.body;

    const result = await withRetry(
      () => horizon.submitTransaction(TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET)),
      { maxAttempts: 2, retryIf: isRetryableHorizonError }
    );
    metrics.totalTransactions++;

    return res.json({
      success: true,
      hash: result.hash,
      explorerUrl: `https://stellar.expert/explorer/${STELLAR_NETWORK}/tx/${result.hash}`,
    });
  } catch (error: unknown) {
    const err = error as Record<string, Record<string, Record<string, unknown>>>;
    const errorMsg = err?.response?.data?.extras
      ? JSON.stringify((err.response.data.extras as Record<string, unknown>).result_codes)
      : error instanceof Error ? error.message : "Transaction submission failed";
    return res.status(500).json({ success: false, error: errorMsg });
  }
});

// Fee-bump (fee sponsorship / gasless tx)
router.post("/fee-bump", walletLimiter, validate(schemas.feeBump), async (req, res) => {
  try {
    const { innerTxXdr } = req.body;

    if (!STELLAR_SECRET_KEY) {
      return res.status(500).json({ success: false, error: "Fee sponsor key not configured" });
    }

    const sponsorKeypair = Keypair.fromSecret(STELLAR_SECRET_KEY);
    const networkPassphrase = STELLAR_NETWORK === "testnet" ? Networks.TESTNET : Networks.PUBLIC;

    const innerTx = TransactionBuilder.fromXDR(innerTxXdr, networkPassphrase);
    const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
      sponsorKeypair,
      BASE_FEE,
      innerTx as Parameters<typeof TransactionBuilder.buildFeeBumpTransaction>[2],
      networkPassphrase
    );
    feeBumpTx.sign(sponsorKeypair);

    const result = await withRetry(
      () => horizon.submitTransaction(feeBumpTx),
      { maxAttempts: 2, retryIf: isRetryableHorizonError }
    );
    metrics.totalTransactions++;

    return res.json({
      success: true,
      hash: result.hash,
      feeSponsor: sponsorKeypair.publicKey(),
      message: "Transaction fee sponsored by StellrFlow",
    });
  } catch (error: unknown) {
    console.error("Fee bump error:", error);
    const msg = error instanceof Error ? error.message : "Fee bump failed";
    return res.status(500).json({ success: false, error: msg });
  }
});

export default router;
