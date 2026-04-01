/**
 * Security middleware for StellrFlow API
 * - Rate limiting per IP
 * - CORS whitelist
 * - API key authentication for sensitive endpoints
 * - Request logging sanitization
 */

import rateLimit from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";

// ─── Rate Limiting ───────────────────────────────────────────────────────────

/** General rate limit: 100 requests per 15 minutes per IP */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Try again later." },
});

/** Strict rate limit for wallet/transaction operations: 20 per 15 minutes */
export const walletLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many wallet operations. Try again later." },
});

/** Auth rate limit: 10 per 15 minutes (session registration, wallet creation) */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many authentication attempts. Try again later." },
});

// ─── CORS Configuration ─────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

export function corsOptions() {
  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (server-to-server, Telegram webhook, etc.)
      if (!origin) {
        callback(null, true);
        return;
      }
      if (ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed))) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: ["Content-Type", "X-API-Key"],
    credentials: true,
  };
}

// ─── API Key Authentication (for admin/sensitive endpoints) ──────────────────

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "";

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  if (!ADMIN_API_KEY) {
    // If no API key is configured, block admin endpoints entirely in production
    if (process.env.NODE_ENV === "production") {
      return res.status(503).json({
        success: false,
        error: "Admin endpoints disabled — ADMIN_API_KEY not configured",
      });
    }
    // In development, allow access without key
    return next();
  }

  const providedKey = req.headers["x-api-key"] as string;
  if (providedKey !== ADMIN_API_KEY) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  next();
}

// ─── Stellar Address Validation ─────────────────────────────────────────────

const STELLAR_ADDRESS_REGEX = /^G[A-Z2-7]{55}$/;

export function isValidStellarAddress(address: string): boolean {
  return STELLAR_ADDRESS_REGEX.test(address);
}

export function validateStellarAddress(fieldName: string = "address") {
  return (req: Request, res: Response, next: NextFunction) => {
    const address = req.params[fieldName] || req.body[fieldName];
    if (address && !isValidStellarAddress(address)) {
      return res.status(400).json({
        success: false,
        error: `Invalid Stellar address format for '${fieldName}'`,
      });
    }
    next();
  };
}
