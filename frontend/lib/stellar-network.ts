// Single source of truth for which Stellar network the whole app talks to.
//
// Controlled by one env var: NEXT_PUBLIC_STELLAR_NETWORK ("testnet" | "mainnet").
// Defaults to "testnet" when unset. Every network-specific endpoint the app
// uses (Horizon, Soroban RPC, Stellar Expert, network passphrase) is derived
// from this module so the app can never accidentally mix networks.

export type StellarNetwork = "testnet" | "mainnet";

export const STELLAR_NETWORK: StellarNetwork =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" ? "mainnet" : "testnet";

interface NetworkConfig {
  horizonUrl: string;
  sorobanRpcUrl: string;
  networkPassphrase: string;
  stellarExpertUrl: string;
}

const NETWORKS: Record<StellarNetwork, NetworkConfig> = {
  testnet: {
    horizonUrl: "https://horizon-testnet.stellar.org",
    sorobanRpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
    stellarExpertUrl: "https://stellar.expert/explorer/testnet",
  },
  mainnet: {
    horizonUrl: "https://horizon.stellar.org",
    sorobanRpcUrl: "https://mainnet.sorobanrpc.com",
    networkPassphrase: "Public Global Stellar Network ; September 2015",
    stellarExpertUrl: "https://stellar.expert/explorer/public",
  },
};

const config = NETWORKS[STELLAR_NETWORK];

export const HORIZON_URL = config.horizonUrl;
export const SOROBAN_RPC_URL = config.sorobanRpcUrl;
export const NETWORK_PASSPHRASE = config.networkPassphrase;
export const STELLAR_EXPERT_URL = config.stellarExpertUrl;
