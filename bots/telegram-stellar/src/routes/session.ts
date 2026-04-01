/**
 * Session management API routes.
 */

import { Router } from "express";
import { authLimiter } from "../middleware/security.js";
import { validate, schemas } from "../middleware/validation.js";
import { activeSessions } from "../state.js";

const router = Router();

// Register session
router.post("/register", authLimiter, validate(schemas.sessionRegister), (req, res) => {
  try {
    const { chatId, features } = req.body;
    const chatIdStr = String(chatId).trim();
    const featureList = Array.isArray(features) ? features : [];

    activeSessions.set(chatIdStr, { features: featureList, registeredAt: new Date() });
    console.log(`Session registered for ${chatIdStr} with features:`, featureList);

    return res.json({
      success: true,
      chatId: chatIdStr,
      features: featureList,
      message: `Session registered with ${featureList.length} feature(s)`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to register session";
    return res.status(500).json({ success: false, error: msg });
  }
});

// Get session info
router.get("/:chatId", (req, res) => {
  const session = activeSessions.get(req.params.chatId);
  if (!session) {
    return res.status(404).json({ success: false, error: "No active session for this chat" });
  }
  return res.json({ success: true, chatId: req.params.chatId, ...session });
});

// Clear session
router.delete("/:chatId", (req, res) => {
  activeSessions.delete(req.params.chatId);
  return res.json({ success: true, message: "Session cleared" });
});

export default router;
