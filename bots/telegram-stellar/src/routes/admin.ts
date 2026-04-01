/**
 * Admin/monitoring routes — metrics, user addresses, health.
 */

import { Router } from "express";
import { requireApiKey } from "../middleware/security.js";
import {
  metrics,
  userWallets,
  freighterWallets,
  activeSessions,
  autoPaySchedules,
  STELLAR_NETWORK,
} from "../state.js";

const router = Router();

// Health check (public)
router.get("/health", (_req, res) => {
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

// Full metrics (admin only)
router.get("/metrics", requireApiKey, (_req, res) => {
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

// List all wallet addresses (admin only)
router.get("/users/addresses", requireApiKey, (_req, res) => {
  const addresses: { type: string; chatId: string; publicKey: string; createdAt: string }[] = [];

  userWallets.forEach((wallet, chatId) => {
    addresses.push({ type: "telegram", chatId, publicKey: wallet.publicKey, createdAt: wallet.createdAt.toISOString() });
  });
  freighterWallets.forEach((wallet, chatId) => {
    addresses.push({ type: "freighter", chatId, publicKey: wallet.publicKey, createdAt: wallet.connectedAt.toISOString() });
  });

  res.json({ success: true, total: addresses.length, addresses });
});

export default router;
