// Reads the WorkflowRegistry Soroban contract's execution count (get_count)
// straight from the browser via a Soroban RPC `simulateTransaction` call.
//
// This app is a static export (next.config.js `output: 'export'`) with no
// server runtime, and the Stellar SDK cannot be added to the client bundle in
// this environment. `get_count` takes no arguments and the contract id is
// fixed, so the InvokeHostFunction transaction envelope is a constant — we
// precompute it once and POST it to Soroban RPC, then decode the u64 return
// value by hand. No SDK, no signing, no funded account required (simulation of
// a no-auth read does not touch account state).
//
// The envelope below was generated with @stellar/stellar-sdk and verified to
// return the live count against soroban-testnet:
//
//   const kp = Keypair.fromRawEd25519Seed(Buffer.alloc(32));   // dummy source
//   const source = new Account(kp.publicKey(), "0");
//   const tx = new TransactionBuilder(source, {
//     fee: "100", networkPassphrase: Networks.TESTNET,
//   }).addOperation(new Contract(CONTRACT_ID).call("get_count"))
//     .setTimeout(0)          // infinite timebounds -> never expires
//     .build();
//   tx.toXDR();

import { SOROBAN_RPC_URL } from "@/lib/stellar-network";

export const WORKFLOW_REGISTRY_CONTRACT_ID =
  "CBATLCK3E5SDUWTGS6SGB7NSDL6KF4EG7DTRI2KIX5TWNQVZSNUYIUMO";

// Precomputed `get_count` invocation envelope for the contract above.
const GET_COUNT_ENVELOPE_XDR =
  "AAAAAgAAAAA7aie8zrakLWKjqNAqbw1zZTIVdx3iQ6Y6wEihi1naKQAAAGQAAAAAAAAAAQAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAGAAAAAAAAAABQTWJWydkOlpml6Rg/bIa/KLwhvjnFGlIv2dmwrmTaYQAAAAJZ2V0X2NvdW50AAAAAAAAAAAAAAAAAAAAAAAAAA==";

// Decode a base64 ScVal that is expected to be an SCV_U64 (discriminant 5),
// laid out as a 4-byte big-endian discriminant followed by a big-endian u64.
function decodeU64FromScValBase64(b64: string): number | null {
  try {
    const bin = atob(b64);
    if (bin.length < 12) return null;
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const view = new DataView(bytes.buffer);
    if (view.getUint32(0, false) !== 5) return null; // 5 = SCV_U64
    return Number(view.getBigUint64(4, false));
  } catch {
    return null;
  }
}

/**
 * Fetch the total number of workflow executions logged on-chain.
 * Returns the live count, or `null` if the RPC is unreachable / errors — the
 * caller must render an explicit empty state, never a fabricated fallback.
 */
export async function fetchExecutionCount(): Promise<number | null> {
  try {
    const res = await fetch(SOROBAN_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "simulateTransaction",
        params: { transaction: GET_COUNT_ENVELOPE_XDR },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.result;
    if (!result || result.error) return null;
    const retvalXdr = result.results?.[0]?.xdr;
    if (!retvalXdr) return null;
    return decodeU64FromScValBase64(retvalXdr);
  } catch {
    return null;
  }
}
