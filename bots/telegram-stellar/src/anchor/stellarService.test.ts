/**
 * StellrFlow — stellarService.ts Unit Tests
 * ==========================================
 * Tests all exported functions:
 *   - getBalance        (3 cases)
 *   - sendXLM           (3 cases)
 *   - fundWithFriendbot (4 cases)
 *   - getTransactionLog (2 cases)
 *   - getLogForAddress  (2 cases)
 *   - getNetworkName    (1 case)
 *
 * Run: npm test
 */

// ── Mock @stellar/stellar-sdk before any imports ──────────────────────────

// Shared mock objects we can manipulate per-test
const mockSubmitTransaction = jest.fn();
const mockLoadAccount = jest.fn();
const mockSign = jest.fn();
const mockBuild = jest.fn(() => ({ sign: mockSign }));
const mockSetTimeout = jest.fn(() => ({ build: mockBuild }));
const mockAddOperation = jest.fn(() => ({ setTimeout: mockSetTimeout }));

jest.mock('@stellar/stellar-sdk', () => {
  const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';

  // A realistic fake keypair so Keypair.fromSecret() works
  const mockKp = {
    publicKey: () => 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGKWD36ONSTNXABUABT56UQ',
    sign: jest.fn(),
  };

  return {
    Horizon: {
      Server: jest.fn().mockImplementation(() => ({
        loadAccount: mockLoadAccount,
        submitTransaction: mockSubmitTransaction,
      })),
    },
    Keypair: {
      fromSecret: jest.fn(() => mockKp),
      random: jest.fn(() => mockKp),
    },
    Networks: {
      TESTNET: TESTNET_PASSPHRASE,
      PUBLIC: 'Public Global Stellar Network ; September 2015',
    },
    TransactionBuilder: jest.fn().mockImplementation(() => ({
      addOperation: mockAddOperation,
    })),
    Operation: {
      payment: jest.fn(() => 'mock-payment-op'),
      createAccount: jest.fn(() => 'mock-createaccount-op'),
    },
    Asset: {
      native: jest.fn(() => 'mock-native-asset'),
    },
    BASE_FEE: '100',
  };
});

// ── Mock global fetch (used by fundWithFriendbot) ─────────────────────────
global.fetch = jest.fn();

// ── Now import the module under test ─────────────────────────────────────
import {
  getBalance,
  sendXLM,
  fundWithFriendbot,
  getTransactionLog,
  getLogForAddress,
  getNetworkName,
} from './stellarService';

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

/** Build a fake Horizon account with native XLM and optional extra assets. */
function makeAccount(xlmBalance: string, extras: any[] = []) {
  return {
    balances: [
      { asset_type: 'native', balance: xlmBalance },
      ...extras,
    ],
    accountId: () => 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGKWD36ONSTNXABUABT56UQ',
    incrementSequenceNumber: jest.fn(),
    sequence: '12345',
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Test Suites
// ─────────────────────────────────────────────────────────────────────────

describe('getNetworkName()', () => {
  it('returns "testnet" by default', () => {
    // process.env.STELLAR_NETWORK defaults to "testnet" in the module
    expect(getNetworkName()).toBe('testnet');
  });
});

// ─────────────────────────────────────────────────────────────────────────

describe('getBalance()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns XLM balance for an existing funded account', async () => {
    mockLoadAccount.mockResolvedValueOnce(makeAccount('9500.0000000'));

    const result = await getBalance('GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGKWD36ONSTNXABUABT56UQ');

    expect(result.exists).toBe(true);
    expect(result.xlm).toBe('9500.0000000');
    expect(result.otherAssets).toHaveLength(0);
  });

  it('returns exists=false for an unfunded account (Horizon throws)', async () => {
    mockLoadAccount.mockRejectedValueOnce(new Error('Account not found'));

    const result = await getBalance('GDUMMYADDRESSNOTFUNDED00000000000000000000000000000000');

    expect(result.exists).toBe(false);
    expect(result.xlm).toBe('0');
    expect(result.otherAssets).toHaveLength(0);
  });

  it('returns other assets (USDC, etc.) alongside XLM balance', async () => {
    const usdcBalance = {
      asset_type: 'credit_alphanum4',
      asset_code: 'USDC',
      asset_issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
      balance: '250.0000000',
    };
    mockLoadAccount.mockResolvedValueOnce(makeAccount('100.0000000', [usdcBalance]));

    const result = await getBalance('GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGKWD36ONSTNXABUABT56UQ');

    expect(result.exists).toBe(true);
    expect(result.xlm).toBe('100.0000000');
    expect(result.otherAssets).toHaveLength(1);
    expect(result.otherAssets[0].code).toBe('USDC');
    expect(result.otherAssets[0].balance).toBe('250.0000000');
  });
});

// ─────────────────────────────────────────────────────────────────────────

describe('sendXLM()', () => {
  const FAKE_SECRET = 'SBFGFF27Y64ZUGFAIG5AMJGQODZZKV2YQKAVUUN4HNE24XZXIZ6ORQN';
  const DEST = 'GDESTINATION000000000000000000000000000000000000000000000';

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the build chain mocks
    mockBuild.mockReturnValue({ sign: mockSign });
    mockSetTimeout.mockReturnValue({ build: mockBuild });
    mockAddOperation.mockReturnValue({ setTimeout: mockSetTimeout });
  });

  it('uses Operation.payment when destination account already exists', async () => {
    const sourceAccount = makeAccount('1000.0000000');
    // First loadAccount = source, second = destination check (exists)
    mockLoadAccount
      .mockResolvedValueOnce(sourceAccount)  // source load
      .mockResolvedValueOnce({ balances: [] }); // destination exists

    mockSubmitTransaction.mockResolvedValueOnce({ hash: 'abc123', ledger: 42 });

    const { Operation } = await import('@stellar/stellar-sdk');
    const result = await sendXLM(FAKE_SECRET, DEST, 10);

    expect(result.success).toBe(true);
    expect(result.hash).toBe('abc123');
    expect(Operation.payment).toHaveBeenCalledWith(
      expect.objectContaining({ destination: DEST })
    );
  });

  it('uses Operation.createAccount when destination does not exist', async () => {
    const sourceAccount = makeAccount('1000.0000000');
    // First loadAccount = source, second = destination throws (not found)
    mockLoadAccount
      .mockResolvedValueOnce(sourceAccount)
      .mockRejectedValueOnce(new Error('Not found'));

    mockSubmitTransaction.mockResolvedValueOnce({ hash: 'def456', ledger: 43 });

    const { Operation } = await import('@stellar/stellar-sdk');
    const result = await sendXLM(FAKE_SECRET, DEST, 10);

    expect(result.success).toBe(true);
    expect(result.hash).toBe('def456');
    expect(Operation.createAccount).toHaveBeenCalledWith(
      expect.objectContaining({ destination: DEST })
    );
  });

  it('returns success=false and records the error when Horizon rejects', async () => {
    const sourceAccount = makeAccount('1000.0000000');
    mockLoadAccount
      .mockResolvedValueOnce(sourceAccount)
      .mockResolvedValueOnce({ balances: [] }); // dest exists

    mockSubmitTransaction.mockRejectedValueOnce(new Error('insufficient balance'));

    const result = await sendXLM(FAKE_SECRET, DEST, 999999);

    expect(result.success).toBe(false);
    expect(result.error).toContain('insufficient balance');

    // The failure should be in the transaction log
    const log = getTransactionLog(5);
    const failEntry = log.find((e: any) => e.status === 'failed');
    expect(failEntry).toBeDefined();
    expect(failEntry?.to).toBe(DEST);
  });
});

// ─────────────────────────────────────────────────────────────────────────

describe('fundWithFriendbot()', () => {
  const TEST_ADDR = 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGKWD36ONSTNXABUABT56UQ';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns success with hash when Friendbot responds OK', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ hash: 'friendbot-hash-xyz' }),
    });

    const result = await fundWithFriendbot(TEST_ADDR);

    expect(result.success).toBe(true);
    expect(result.hash).toBe('friendbot-hash-xyz');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(TEST_ADDR)
    );
  });

  it('treats createAccountAlreadyExist as a success (not an error)', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'op_already_exists createAccountAlreadyExist',
    });

    const result = await fundWithFriendbot(TEST_ADDR);

    expect(result.success).toBe(true);
    expect(result.hash).toBe('already-funded');
  });

  it('returns success=false when Friendbot returns a real HTTP error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    const result = await fundWithFriendbot(TEST_ADDR);

    expect(result.success).toBe(false);
    expect(result.error).toContain('500');
  });

  it('returns success=false when fetch itself throws a network error', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network timeout'));

    const result = await fundWithFriendbot(TEST_ADDR);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network timeout');
  });
});

// ─────────────────────────────────────────────────────────────────────────

describe('getTransactionLog()', () => {
  it('returns entries in newest-first order', async () => {
    // Trigger two successful Friendbot calls to populate the log
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ hash: 'hash-A' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ hash: 'hash-B' }) });

    await fundWithFriendbot('GADDR1111111111111111111111111111111111111111111111111111');
    await fundWithFriendbot('GADDR2222222222222222222222222222222222222222222222222222');

    const log = getTransactionLog(10);

    // Newest entry should be first
    expect(log.length).toBeGreaterThanOrEqual(2);
    const hashes = log.map((e: any) => e.hash);
    const idxA = hashes.indexOf('hash-A');
    const idxB = hashes.indexOf('hash-B');
    // B was logged after A, so B should appear before A (lower index = newer)
    expect(idxB).toBeLessThan(idxA);
  });

  it('respects the limit parameter', async () => {
    const log = getTransactionLog(2);
    expect(log.length).toBeLessThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────

describe('getLogForAddress()', () => {
  const TARGET = 'GTARGET111111111111111111111111111111111111111111111111111';
  const OTHER  = 'GOTHER0000000000000000000000000000000000000000000000000000';

  it('only returns entries matching the queried address', async () => {
    // Fund the target address to create a log entry for it
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ hash: 'target-hash' }),
    });
    await fundWithFriendbot(TARGET);

    const log = getLogForAddress(TARGET, 20);

    // Every entry must involve the target address
    log.forEach((entry: any) => {
      const involves = entry.from === TARGET || entry.to === TARGET;
      expect(involves).toBe(true);
    });
  });

  it('returns an empty array when the address has no log entries', () => {
    const log = getLogForAddress('GNEVERUSED0000000000000000000000000000000000000000000000', 10);
    expect(log).toEqual([]);
  });
});
