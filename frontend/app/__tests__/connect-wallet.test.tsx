import { render, screen, fireEvent } from "@testing-library/react";
import ConnectWalletPage from "@/app/connect-wallet/page";

// PostHog capture is a no-op in tests.
jest.mock("@/lib/posthog", () => ({ capture: jest.fn() }));

// The wallet kit is mocked so we drive the page's state machine deterministically.
const mockConnect = jest.fn();
const mockGetKitNetwork = jest.fn();
const mockGetStored = jest.fn();
const mockIsConnected = jest.fn();
jest.mock("@/lib/wallet-kit", () => ({
  connectWallet: (...a: unknown[]) => mockConnect(...a),
  getKitNetwork: (...a: unknown[]) => mockGetKitNetwork(...a),
  getStoredAddress: (...a: unknown[]) => mockGetStored(...a),
  isWalletConnected: (...a: unknown[]) => mockIsConnected(...a),
}));

// No chatId in the URL -> the backend/telegram calls are skipped.
jest.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: () => null }),
}));

describe("connect-wallet state machine", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsConnected.mockReturnValue(false); // no auto-reconnect
    mockGetStored.mockReturnValue(null);
    mockGetKitNetwork.mockResolvedValue("TESTNET");
    // Stub navigation so the post-connect redirect timer is harmless in jsdom.
    delete (window as unknown as { location?: unknown }).location;
    (window as unknown as { location: { href: string } }).location = { href: "" };
  });

  it("starts idle with a connect button and multi-wallet hint", () => {
    render(<ConnectWalletPage />);
    expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
    expect(screen.getByText(/Freighter, Albedo and xBull/i)).toBeInTheDocument();
  });

  it("transitions to the connected state after a successful connect", async () => {
    mockConnect.mockResolvedValue({ address: "GTESTADDRESS", walletId: "freighter" });
    render(<ConnectWalletPage />);

    fireEvent.click(screen.getByRole("button", { name: /connect wallet/i }));

    expect(await screen.findByText(/Wallet Connected!/i)).toBeInTheDocument();
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it("shows an error and a retry button when the connect is rejected", async () => {
    mockConnect.mockRejectedValue(new Error("user rejected"));
    render(<ConnectWalletPage />);

    fireEvent.click(screen.getByRole("button", { name: /connect wallet/i }));

    expect(await screen.findByText(/user rejected/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
