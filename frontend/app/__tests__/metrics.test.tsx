import { render, screen } from "@testing-library/react";
import MetricsPage from "@/app/metrics/page";

// Stub the on-chain contract read so no Soroban RPC call is made.
jest.mock("@/lib/workflow-registry", () => ({
  fetchExecutionCount: jest.fn().mockResolvedValue(null),
  WORKFLOW_REGISTRY_CONTRACT_ID:
    "CTESTCONTRACTID00000000000000000000000000000000000000000",
}));

describe("metrics page", () => {
  beforeEach(() => {
    // Horizon returns no transactions for the app account.
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ _embedded: { records: [] } }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders the dashboard and an empty transaction state when there is no live data", async () => {
    render(<MetricsPage />);

    expect(screen.getByText("Metrics Dashboard")).toBeInTheDocument();
    // Once the mocked (empty) Horizon fetch resolves, the feed shows its empty state.
    expect(
      await screen.findByText(/No transactions on record for this wallet/i)
    ).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalled();
  });
});
