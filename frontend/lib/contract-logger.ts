// Records a completed workflow run on the WorkflowRegistry contract, signed by
// the connected wallet (Freighter / Albedo / xBull, via stellar-wallets-kit).
//
// The app is a static export with no Stellar SDK in the bundle, so the Soroban
// invoke transaction is built and submitted by the bot backend (which has the
// SDK) and only *signed* here in the browser through the wallet kit:
//
//   1. POST /api/contract/log/build  -> prepared XDR (executor == wallet key)
//   2. kit.signTransaction(xdr)       -> signed XDR
//   3. POST /api/contract/log/submit -> tx hash
//
// Non-blocking by contract: this never throws. If no wallet is connected we
// return { skipped: true }; any other failure returns { success: false, error }.
// A failed on-chain log must never fail the workflow that triggered it.

import { getKitNetwork, getStoredAddress, signWithKit } from "@/lib/wallet-kit";
import { STELLAR_EXPERT_URL } from "@/lib/stellar-network";

const STELLAR_BOT_URL =
  process.env.NEXT_PUBLIC_STELLAR_BOT_URL || "http://localhost:3003";

const PASSPHRASES: Record<string, string> = {
  testnet: "Test SDF Network ; September 2015",
  mainnet: "Public Global Stellar Network ; September 2015",
};

export interface LogRunResult {
  success: boolean;
  skipped?: boolean;
  hash?: string;
  explorerUrl?: string;
  error?: string;
}

export async function logWorkflowRun(params: {
  workflowId: string;
  nodeCount: number;
  success: boolean;
}): Promise<LogRunResult> {
  try {
    // A connected wallet is required to sign — skip quietly otherwise.
    const address = getStoredAddress();
    if (!address) return { success: false, skipped: true, error: "No wallet connected" };

    const network = (await getKitNetwork() || "TESTNET").toUpperCase().includes("PUBLIC")
      ? "mainnet"
      : "testnet";

    // 1. Build the prepared invoke transaction on the bot backend.
    const buildRes = await fetch(`${STELLAR_BOT_URL}/api/contract/log/build`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        executor: address,
        workflowId: params.workflowId,
        nodeCount: params.nodeCount,
        success: params.success,
        network,
      }),
    });
    const build = await buildRes.json();
    if (!build.success) return { success: false, error: build.error || "Failed to build log transaction" };

    // 2. Sign with the connected wallet.
    const signedXdr = await signWithKit(build.xdr, {
      networkPassphrase: PASSPHRASES[network] || PASSPHRASES.testnet,
      address,
    });

    // 3. Submit via the bot backend.
    const submitRes = await fetch(`${STELLAR_BOT_URL}/api/contract/log/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signedXdr, network }),
    });
    const submit = await submitRes.json();
    if (!submit.success) return { success: false, error: submit.error || "Failed to submit log", hash: submit.hash };

    return {
      success: true,
      hash: submit.hash,
      explorerUrl: submit.explorerUrl || `${STELLAR_EXPERT_URL}/tx/${submit.hash}`,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "On-chain logging failed" };
  }
}
