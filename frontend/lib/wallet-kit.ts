// Multi-wallet support via @creit.tech/stellar-wallets-kit.
//
// One shared kit configured with Freighter, Albedo and xBull. The kit's built-in
// auth modal is the wallet picker (shows all three), and signing is routed
// through whichever wallet the user chose — the rest of the app never talks to a
// specific wallet SDK.
//
// The kit is a static, browser-only singleton. It is dynamic-imported (and its
// init memoised) so it never loads during the static-export prerender, and so
// init() runs exactly once per page load. The chosen wallet id + address are
// persisted to localStorage so signing works across the app's separate pages.

import { STELLAR_NETWORK } from "@/lib/stellar-network";

const WALLET_ID_KEY = "stellrflow_wallet_id";
const WALLET_ADDR_KEY = "stellrflow_wallet_address";

type KitModule = typeof import("@creit.tech/stellar-wallets-kit");

let kitPromise: Promise<KitModule> | null = null;

async function loadKit(): Promise<KitModule> {
  if (kitPromise) return kitPromise;
  kitPromise = (async () => {
    const [kit, freighter, albedo, xbull] = await Promise.all([
      import("@creit.tech/stellar-wallets-kit"),
      import("@creit.tech/stellar-wallets-kit/modules/freighter"),
      import("@creit.tech/stellar-wallets-kit/modules/albedo"),
      import("@creit.tech/stellar-wallets-kit/modules/xbull"),
    ]);

    const savedId = localStorage.getItem(WALLET_ID_KEY) || freighter.FREIGHTER_ID;
    kit.StellarWalletsKit.init({
      network: STELLAR_NETWORK === "mainnet" ? kit.Networks.PUBLIC : kit.Networks.TESTNET,
      selectedWalletId: savedId,
      // Show every configured wallet in the picker, installed or not.
      authModal: { hideUnsupportedWallets: false },
      modules: [
        new freighter.FreighterModule(),
        new albedo.AlbedoModule(),
        new xbull.xBullModule(),
      ],
    });
    return kit;
  })();
  return kitPromise;
}

/** The connected wallet's address from a previous action, if any (sync). */
export function getStoredAddress(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(WALLET_ADDR_KEY);
}

/** Whether a wallet has been connected (address persisted). */
export function isWalletConnected(): boolean {
  return Boolean(getStoredAddress());
}

/**
 * Open the wallet picker (Freighter / Albedo / xBull). Returns the selected
 * wallet's address and id, and persists both for later signing.
 */
export async function connectWallet(): Promise<{ address: string; walletId: string }> {
  const kit = await loadKit();
  const { address } = await kit.StellarWalletsKit.authModal();
  const walletId =
    kit.StellarWalletsKit.selectedModule?.productId ||
    localStorage.getItem(WALLET_ID_KEY) ||
    "";
  if (walletId) localStorage.setItem(WALLET_ID_KEY, walletId);
  localStorage.setItem(WALLET_ADDR_KEY, address);
  return { address, walletId };
}

/** Sign an XDR with whichever wallet the user connected. Returns the signed XDR. */
export async function signWithKit(
  xdr: string,
  opts?: { networkPassphrase?: string; address?: string },
): Promise<string> {
  const kit = await loadKit();
  const { signedTxXdr } = await kit.StellarWalletsKit.signTransaction(xdr, {
    networkPassphrase: opts?.networkPassphrase,
    address: opts?.address || getStoredAddress() || undefined,
  });
  return signedTxXdr;
}

/** The connected wallet's reported network name (e.g. "TESTNET"), or null. */
export async function getKitNetwork(): Promise<string | null> {
  try {
    const kit = await loadKit();
    const { network } = await kit.StellarWalletsKit.getNetwork();
    return network || null;
  } catch {
    return null;
  }
}

/** Disconnect and clear the persisted wallet. */
export async function disconnectWallet(): Promise<void> {
  try {
    const kit = await loadKit();
    await kit.StellarWalletsKit.disconnect();
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    localStorage.removeItem(WALLET_ID_KEY);
    localStorage.removeItem(WALLET_ADDR_KEY);
  }
}
