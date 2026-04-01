/**
 * AutoPay scheduling routes.
 */

import { Router } from "express";
import { walletLimiter } from "../middleware/security.js";
import { validate, schemas } from "../middleware/validation.js";
import {
  autoPaySchedules,
  getWallet,
  nextScheduleId,
} from "../state.js";

const router = Router();

// Create scheduled payment
router.post("/create", walletLimiter, validate(schemas.createAutoPay), (req, res) => {
  try {
    const { chatId, destination, amount, interval, duration } = req.body;

    const wallet = getWallet(String(chatId));
    if (!wallet) {
      return res.status(404).json({ success: false, error: "No wallet connected. Connect a wallet first." });
    }

    const scheduleId = nextScheduleId();
    const now = new Date();
    const nextPayment = new Date(now);

    if (interval === "daily") nextPayment.setDate(nextPayment.getDate() + 1);
    else if (interval === "weekly") nextPayment.setDate(nextPayment.getDate() + 7);
    else if (interval === "monthly") nextPayment.setMonth(nextPayment.getMonth() + 1);
    else nextPayment.setHours(nextPayment.getHours() + 1);

    autoPaySchedules.set(scheduleId, {
      scheduleId,
      chatId: String(chatId),
      destination,
      amount: parseFloat(amount),
      interval: interval || "daily",
      duration: parseInt(duration) || 30,
      createdAt: now,
      nextPayment,
      isActive: true,
    });

    return res.json({
      success: true,
      scheduleId,
      destination,
      amount: parseFloat(amount),
      interval: interval || "daily",
      duration: parseInt(duration) || 30,
      nextPayment: nextPayment.toISOString(),
      message: "AutoPay schedule created successfully",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create schedule";
    return res.status(500).json({ success: false, error: msg });
  }
});

// Get user's schedules
router.get("/:chatId", (req, res) => {
  const schedules = Array.from(autoPaySchedules.values()).filter((s) => s.chatId === req.params.chatId);
  return res.json({ success: true, schedules });
});

// Cancel a schedule
router.delete("/:scheduleId", (req, res) => {
  const schedule = autoPaySchedules.get(req.params.scheduleId);
  if (!schedule) {
    return res.status(404).json({ success: false, error: "Schedule not found" });
  }
  autoPaySchedules.delete(req.params.scheduleId);
  return res.json({ success: true, message: "Schedule cancelled" });
});

export default router;
