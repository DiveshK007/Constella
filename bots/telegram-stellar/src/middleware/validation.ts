/**
 * Zod validation schemas for API request bodies.
 * Used as Express middleware to validate incoming requests.
 */

import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

// ─── Shared Validators ──────────────────────────────────────────────────────

const stellarAddress = z.string().regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar address");
const chatId = z.string().min(1, "chatId is required").max(20);
const positiveAmount = z.coerce.number().positive("Amount must be positive");

// ─── Request Schemas ────────────────────────────────────────────────────────

export const schemas = {
  sendMessage: z.object({
    chatId: chatId,
    message: z.string().min(1).max(4096, "Message too long (max 4096 chars)"),
    parseMode: z.enum(["Markdown", "HTML", "MarkdownV2"]).optional(),
    disableNotification: z.boolean().optional(),
  }),

  createWallet: z.object({
    chatId: chatId,
  }),

  sendXLM: z.object({
    destination: stellarAddress,
    amount: positiveAmount,
  }),

  freighterConnect: z.object({
    chatId: chatId,
    publicKey: stellarAddress,
    network: z.enum(["testnet", "mainnet"]).optional(),
  }),

  buildTransaction: z.object({
    sourceAddress: stellarAddress,
    destination: stellarAddress,
    amount: positiveAmount,
    network: z.enum(["testnet", "mainnet"]).optional(),
  }),

  submitTransaction: z.object({
    signedXdr: z.string().min(1, "signedXdr is required").max(10000),
    chatId: z.string().optional(),
  }),

  logBuild: z.object({
    executor: stellarAddress,
    workflowId: z.string().min(1).max(64),
    nodeCount: z.coerce.number().int().min(0).max(1000).optional().default(0),
    success: z.boolean().optional().default(true),
    network: z.enum(["testnet", "mainnet"]).optional(),
  }),

  logSubmit: z.object({
    signedXdr: z.string().min(1, "signedXdr is required").max(20000),
    network: z.enum(["testnet", "mainnet"]).optional(),
  }),

  feeBump: z.object({
    innerTxXdr: z.string().min(1, "innerTxXdr is required").max(10000),
  }),

  anchorDeposit: z.object({
    chatId: chatId,
    amount: positiveAmount,
    currency: z.enum(["USD", "EUR", "INR"]).optional().default("USD"),
  }),

  anchorWithdraw: z.object({
    chatId: chatId,
    xlmAmount: positiveAmount,
    currency: z.enum(["USD", "EUR", "INR"]).optional().default("USD"),
  }),

  sessionRegister: z.object({
    chatId: chatId,
    features: z.array(z.string().max(50)).max(20).optional().default([]),
  }),

  createAutoPay: z.object({
    chatId: chatId,
    destination: stellarAddress,
    amount: positiveAmount,
    interval: z.enum(["hourly", "daily", "weekly", "monthly"]).optional().default("daily"),
    duration: z.coerce.number().int().min(1).max(365).optional().default(30),
  }),

  createMultisig: z.object({
    chatId: chatId,
    threshold: z.coerce.number().int().min(1).max(10),
    signers: z.array(stellarAddress).min(1).max(10),
    timeout: z.coerce.number().int().min(1).max(168).optional().default(24),
  }),
};

// ─── Middleware Factory ─────────────────────────────────────────────────────

/**
 * Creates Express middleware that validates req.body against the given Zod schema.
 * On failure, returns 400 with structured error messages.
 */
export function validate<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors,
      });
    }
    // Replace body with parsed (and coerced) data
    req.body = result.data;
    next();
  };
}
