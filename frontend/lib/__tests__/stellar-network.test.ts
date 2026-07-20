// The network-config module derives all endpoints from NEXT_PUBLIC_STELLAR_NETWORK
// at import time, so each case resets the module registry and re-imports.

describe("stellar-network config", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("defaults to testnet endpoints when the env var is unset", () => {
    delete process.env.NEXT_PUBLIC_STELLAR_NETWORK;
    const cfg = require("@/lib/stellar-network");
    expect(cfg.STELLAR_NETWORK).toBe("testnet");
    expect(cfg.HORIZON_URL).toBe("https://horizon-testnet.stellar.org");
    expect(cfg.SOROBAN_RPC_URL).toBe("https://soroban-testnet.stellar.org");
    expect(cfg.NETWORK_PASSPHRASE).toContain("Test SDF Network");
    expect(cfg.STELLAR_EXPERT_URL).toContain("/testnet");
  });

  it("uses mainnet endpoints when NEXT_PUBLIC_STELLAR_NETWORK=mainnet", () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "mainnet";
    const cfg = require("@/lib/stellar-network");
    expect(cfg.STELLAR_NETWORK).toBe("mainnet");
    expect(cfg.HORIZON_URL).toBe("https://horizon.stellar.org");
    expect(cfg.NETWORK_PASSPHRASE).toContain("Public Global Stellar Network");
    expect(cfg.STELLAR_EXPERT_URL).toContain("/public");
  });
});
