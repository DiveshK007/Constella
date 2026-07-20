/**
 * ============================================================
 *  StellrFlow — WorkflowRegistry contract logger
 * ============================================================
 *
 *  Records workflow / transaction runs on-chain by invoking the
 *  WorkflowRegistry Soroban contract's `log_execution` function:
 *
 *    log_execution(executor: Address, workflow_id: String,
 *                  node_count: u32, success: bool) -> u64
 *
 *  `executor.require_auth()` inside the contract is satisfied by the
 *  transaction's own source-account signature (executor == tx source),
 *  so no separate auth-entry signing is needed.
 *
 *  Two entry points:
 *    • logExecutionWithSecret() — build + sign + submit in one go, used
 *      by the bot for its in-bot (Telegram) wallets.
 *    • buildLogExecutionXdr() / submitSignedXdr() — split flow for the
 *      frontend, where Freighter signs the prepared XDR in the browser.
 *
 *  Everything here is non-blocking by contract: the *WithSecret and
 *  submit helpers never throw — failures are returned as
 *  { success: false, error }, so a failed on-chain log never breaks the
 *  workflow / payment that triggered it.
 *
 *  @module contractLogger
 */

import {
  rpc,
  Contract,
  TransactionBuilder,
  Keypair,
  Networks,
  Address,
  nativeToScVal,
  BASE_FEE,
  xdr,
  Transaction,
} from "@stellar/stellar-sdk";

// Network config is read straight from the environment (mirroring
// anchor/stellarService.ts) rather than imported from state.ts, so this module
// stays free of state.ts's import.meta usage and is unit-testable under Jest.
const STELLAR_NETWORK = process.env.STELLAR_NETWORK || "testnet";
const RPC_URL =
  process.env.STELLAR_RPC_URL ||
  (STELLAR_NETWORK === "testnet"
    ? "https://soroban-testnet.stellar.org"
    : "https://soroban-mainnet.stellar.org");

/** Deployed WorkflowRegistry contract (testnet). Overridable via env. */
export const WORKFLOW_REGISTRY_CONTRACT_ID =
  process.env.WORKFLOW_REGISTRY_CONTRACT_ID ||
  "CBATLCK3E5SDUWTGS6SGB7NSDL6KF4EG7DTRI2KIX5TWNQVZSNUYIUMO";

export interface LogResult {
  success: boolean;
  hash?: string;
  error?: string;
}

/**
 * Minimal slice of the Soroban RPC server this module depends on.
 * Declaring it as an interface lets tests inject a fake server and
 * exercise the full build/sign/submit flow without touching the network.
 */
export interface SorobanServerLike {
  getAccount(address: string): Promise<{ accountId(): string; sequenceNumber(): string; incrementSequenceNumber(): void }>;
  prepareTransaction(tx: Transaction): Promise<Transaction>;
  sendTransaction(tx: Transaction): Promise<{ status: string; hash: string; errorResult?: unknown }>;
  getTransaction(hash: string): Promise<{ status: string; returnValue?: xdr.ScVal }>;
}

/** Construct the real Soroban RPC server for the configured network. */
export function createServer(): SorobanServerLike {
  return new rpc.Server(RPC_URL) as unknown as SorobanServerLike;
}

function passphraseFor(network?: string): string {
  return (network || STELLAR_NETWORK) === "testnet" ? Networks.TESTNET : Networks.PUBLIC;
}

function safeStringify(v: unknown): string {
  try {
    return typeof v === "string" ? v : JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/**
 * Build the ScVal argument list for `log_execution`. Pure and side-effect
 * free — the primary unit-test surface for argument correctness.
 */
export function buildLogExecutionArgs(
  executor: string,
  workflowId: string,
  nodeCount: number,
  success: boolean,
): xdr.ScVal[] {
  const safeNodeCount = Number.isFinite(nodeCount) ? Math.max(0, Math.floor(nodeCount)) : 0;
  return [
    new Address(executor).toScVal(),
    nativeToScVal(workflowId, { type: "string" }),
    nativeToScVal(safeNodeCount, { type: "u32" }),
    nativeToScVal(success, { type: "bool" }),
  ];
}

/** Poll getTransaction until it leaves NOT_FOUND, or attempts run out. */
async function waitForTx(
  server: SorobanServerLike,
  hash: string,
  attempts = 15,
  delayMs = 1000,
): Promise<{ status: string; returnValue?: xdr.ScVal }> {
  let resp = await server.getTransaction(hash);
  for (let i = 0; i < attempts && resp.status === "NOT_FOUND"; i++) {
    await new Promise((r) => setTimeout(r, delayMs));
    resp = await server.getTransaction(hash);
  }
  return resp;
}

/**
 * Build a prepared (simulated) `log_execution` transaction for `executor`
 * to sign externally (e.g. via Freighter). Returns the base64 XDR.
 * Throws on failure — the caller (an API route) maps that to a 500.
 */
export async function buildLogExecutionXdr(
  params: { executor: string; workflowId: string; nodeCount: number; success: boolean; network?: string },
  server: SorobanServerLike = createServer(),
): Promise<string> {
  const source = await server.getAccount(params.executor);
  const contract = new Contract(WORKFLOW_REGISTRY_CONTRACT_ID);
  const args = buildLogExecutionArgs(params.executor, params.workflowId, params.nodeCount, params.success);
  const tx = new TransactionBuilder(source as never, {
    fee: BASE_FEE,
    networkPassphrase: passphraseFor(params.network),
  })
    .addOperation(contract.call("log_execution", ...args))
    .setTimeout(300)
    .build();
  const prepared = await server.prepareTransaction(tx);
  return prepared.toXDR();
}

/** Submit an externally-signed `log_execution` transaction. Never throws. */
export async function submitSignedXdr(
  signedXdr: string,
  network?: string,
  server: SorobanServerLike = createServer(),
): Promise<LogResult> {
  try {
    const tx = TransactionBuilder.fromXDR(signedXdr, passphraseFor(network)) as Transaction;
    const sent = await server.sendTransaction(tx);
    if (sent.status === "ERROR") {
      return { success: false, error: safeStringify(sent.errorResult) };
    }
    const resp = await waitForTx(server, sent.hash);
    if (resp.status === "SUCCESS") return { success: true, hash: sent.hash };
    return { success: false, hash: sent.hash, error: `tx status ${resp.status}` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "submit failed" };
  }
}

/**
 * Build, sign (with `secret`) and submit a `log_execution` call in one shot.
 * Non-blocking by contract: never throws — failures come back as
 * { success: false, error }.
 */
export async function logExecutionWithSecret(
  params: { secret: string; workflowId: string; nodeCount: number; success: boolean; network?: string },
  server: SorobanServerLike = createServer(),
): Promise<LogResult> {
  try {
    const kp = Keypair.fromSecret(params.secret);
    const source = await server.getAccount(kp.publicKey());
    const contract = new Contract(WORKFLOW_REGISTRY_CONTRACT_ID);
    const args = buildLogExecutionArgs(kp.publicKey(), params.workflowId, params.nodeCount, params.success);
    const tx = new TransactionBuilder(source as never, {
      fee: BASE_FEE,
      networkPassphrase: passphraseFor(params.network),
    })
      .addOperation(contract.call("log_execution", ...args))
      .setTimeout(30)
      .build();
    const prepared = await server.prepareTransaction(tx);
    prepared.sign(kp);
    const sent = await server.sendTransaction(prepared);
    if (sent.status === "ERROR") {
      return { success: false, error: safeStringify(sent.errorResult) };
    }
    const resp = await waitForTx(server, sent.hash);
    if (resp.status === "SUCCESS") return { success: true, hash: sent.hash };
    return { success: false, hash: sent.hash, error: `tx status ${resp.status}` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "log_execution failed" };
  }
}
