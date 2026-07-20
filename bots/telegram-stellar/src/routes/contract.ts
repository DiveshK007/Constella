/**
 * WorkflowRegistry contract routes — build + submit `log_execution` calls
 * for the frontend, where Freighter signs the prepared XDR in the browser.
 */

import { Router } from "express";
import { walletLimiter } from "../middleware/security.js";
import { validate, schemas } from "../middleware/validation.js";
import { STELLAR_NETWORK } from "../state.js";
import { buildLogExecutionXdr, submitSignedXdr } from "../contractLogger.js";

const router = Router();

// Build a prepared log_execution transaction for Freighter to sign.
router.post("/log/build", walletLimiter, validate(schemas.logBuild), async (req, res) => {
  try {
    const { executor, workflowId, nodeCount, success, network } = req.body;
    const xdr = await buildLogExecutionXdr({
      executor,
      workflowId,
      nodeCount: Number(nodeCount) || 0,
      success: success !== false,
      network,
    });
    return res.json({ success: true, xdr, network: network || STELLAR_NETWORK });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to build log transaction";
    return res.status(500).json({ success: false, error: msg });
  }
});

// Submit a signed log_execution transaction.
router.post("/log/submit", walletLimiter, validate(schemas.logSubmit), async (req, res) => {
  const { signedXdr, network } = req.body;
  const result = await submitSignedXdr(signedXdr, network);
  if (result.success) {
    return res.json({
      success: true,
      hash: result.hash,
      explorerUrl: `https://stellar.expert/explorer/${network || STELLAR_NETWORK}/tx/${result.hash}`,
    });
  }
  return res.status(500).json({ success: false, error: result.error, hash: result.hash });
});

export default router;
