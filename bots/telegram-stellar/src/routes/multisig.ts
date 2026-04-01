/**
 * Multisig configuration routes.
 */

import { Router } from "express";
import { walletLimiter } from "../middleware/security.js";
import { validate, schemas } from "../middleware/validation.js";
import { multisigConfigs, nextMultisigId } from "../state.js";

const router = Router();

// Create multisig configuration
router.post("/create", walletLimiter, validate(schemas.createMultisig), (req, res) => {
  try {
    const { chatId, threshold, signers, timeout } = req.body;
    const multisigId = nextMultisigId();

    multisigConfigs.set(multisigId, {
      multisigId,
      chatId: String(chatId),
      threshold: parseInt(threshold),
      signers: signers || [],
      timeout: parseInt(timeout) || 24,
      createdAt: new Date(),
      isActive: true,
    });

    console.log(`Multisig configured: ${multisigId} for ${chatId} (${threshold}/${signers.length})`);

    return res.json({
      success: true,
      multisigId,
      threshold: parseInt(threshold),
      signerCount: signers.length,
      timeout: parseInt(timeout) || 24,
      message: "Multisig configured successfully",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to configure multisig";
    return res.status(500).json({ success: false, error: msg });
  }
});

// Get multisig configs for a chat
router.get("/:chatId", (req, res) => {
  const configs = Array.from(multisigConfigs.values()).filter((c) => c.chatId === req.params.chatId);
  return res.json({ success: true, configs });
});

export default router;
