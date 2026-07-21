/**
 * Admin/monitoring routes — metrics, user addresses, health.
 */

import { Router } from "express";
import { requireApiKey, requireAdminToken } from "../middleware/security.js";
import {
  metrics,
  userWallets,
  freighterWallets,
  activeSessions,
  autoPaySchedules,
  STELLAR_NETWORK,
  HORIZON_URL,
} from "../state.js";
import { collectUserRows, buildUsersCsv } from "../usersExport.js";

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

// Export all registered users as CSV (admin only, ADMIN_TOKEN).
// address, registered_at, source (bot|freighter), tx_count (live from Horizon).
router.get("/users/export", requireAdminToken, async (_req, res) => {
  try {
    const rows = await collectUserRows({
      botWallets: Array.from(userWallets.values()),
      freighterWallets: Array.from(freighterWallets.values()),
      horizonUrl: HORIZON_URL,
    });
    const csv = buildUsersCsv(rows);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="stellrflow_users.csv"');
    return res.status(200).send(csv);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Export failed";
    return res.status(500).json({ success: false, error: msg });
  }
});

export default router;
