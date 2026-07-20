/**
 * Tests for the WorkflowRegistry contract logger.
 *
 * The full build → sign → submit flow is exercised against an injected fake
 * Soroban RPC server, so no network access is required. The focus is:
 *   1. log_execution arguments are encoded as the correct ScVal types.
 *   2. logExecutionWithSecret is non-blocking — it resolves to
 *      { success: false } instead of throwing when the contract call fails.
 *   3. A successful submit surfaces the transaction hash.
 */

import { Account, Keypair, Networks, scValToNative } from "@stellar/stellar-sdk";
import {
  buildLogExecutionArgs,
  logExecutionWithSecret,
  submitSignedXdr,
  WORKFLOW_REGISTRY_CONTRACT_ID,
  type SorobanServerLike,
} from "./contractLogger.js";

const EXECUTOR = "GCF7NYIJCVBHF5S4BWJPZZ4ANNLPABWNBCUVNRLYTSULATKCAPGCNMYV";

/** A fake Soroban server whose per-method behaviour each test overrides. */
function fakeServer(overrides: Partial<SorobanServerLike> = {}): SorobanServerLike {
  return {
    getAccount: async (address: string) => new Account(address, "0"),
    prepareTransaction: async (tx) => tx, // skip real simulation, keep the built tx
    sendTransaction: async () => ({ status: "PENDING", hash: "HASH_OK" }),
    getTransaction: async () => ({ status: "SUCCESS" }),
    ...overrides,
  } as SorobanServerLike;
}

describe("buildLogExecutionArgs", () => {
  it("encodes executor/workflowId/nodeCount/success as the right ScVal types", () => {
    const args = buildLogExecutionArgs(EXECUTOR, "workflow-run", 3, true);
    expect(args).toHaveLength(4);
    expect(scValToNative(args[0])).toBe(EXECUTOR); // Address -> G... string
    expect(scValToNative(args[1])).toBe("workflow-run"); // String
    expect(Number(scValToNative(args[2]))).toBe(3); // u32
    expect(scValToNative(args[3])).toBe(true); // bool
  });

  it("coerces a fractional/negative node count into a safe u32", () => {
    const args = buildLogExecutionArgs(EXECUTOR, "wf", -4.7, false);
    expect(Number(scValToNative(args[2]))).toBe(0);
    expect(scValToNative(args[3])).toBe(false);
  });
});

describe("logExecutionWithSecret", () => {
  const secret = Keypair.random().secret();

  it("returns the tx hash when the contract call succeeds", async () => {
    const result = await logExecutionWithSecret(
      { secret, workflowId: "telegram-send", nodeCount: 1, success: true, network: "testnet" },
      fakeServer()
    );
    expect(result).toEqual({ success: true, hash: "HASH_OK" });
  });

  it("is non-blocking: resolves to an error instead of throwing when RPC fails", async () => {
    const boom = fakeServer({
      getAccount: async () => {
        throw new Error("horizon unreachable");
      },
    });
    // Must not reject — a failed log must never break the caller's workflow.
    const result = await logExecutionWithSecret(
      { secret, workflowId: "telegram-send", nodeCount: 1, success: true },
      boom
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/unreachable/);
  });

  it("reports a non-success final tx status without throwing", async () => {
    const failed = fakeServer({
      sendTransaction: async () => ({ status: "PENDING", hash: "HASH_FAIL" }),
      getTransaction: async () => ({ status: "FAILED" }),
    });
    const result = await logExecutionWithSecret(
      { secret, workflowId: "wf", nodeCount: 2, success: true },
      failed
    );
    expect(result.success).toBe(false);
    expect(result.hash).toBe("HASH_FAIL");
    expect(result.error).toMatch(/FAILED/);
  });

  it("surfaces a rejected send as an error result", async () => {
    const errored = fakeServer({
      sendTransaction: async () => ({ status: "ERROR", hash: "", errorResult: "tx_malformed" }),
    });
    const result = await logExecutionWithSecret(
      { secret, workflowId: "wf", nodeCount: 1, success: true },
      errored
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/tx_malformed/);
  });
});

describe("submitSignedXdr", () => {
  it("returns an error result (never throws) on malformed XDR", async () => {
    const result = await submitSignedXdr("not-valid-xdr", "testnet", fakeServer());
    expect(result.success).toBe(false);
    expect(typeof result.error).toBe("string");
  });
});

describe("contract id", () => {
  it("targets the deployed WorkflowRegistry contract", () => {
    expect(WORKFLOW_REGISTRY_CONTRACT_ID).toMatch(/^C[A-Z2-7]{55}$/);
  });
});
