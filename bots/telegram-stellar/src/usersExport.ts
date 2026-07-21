/**
 * Users export — turns the app's *actual* registrations (in-bot Telegram
 * wallets + connected Freighter wallets) into CSV onboarding evidence.
 *
 * Every row comes from a real registration; the only derived field is
 * `tx_count`, fetched live from Horizon. When Horizon is unreachable the count
 * is 0 — never a fabricated number.
 *
 * Kept free of state.ts (and its import.meta usage) so it is unit-testable.
 */

export interface UserRow {
  address: string;
  registered_at: string; // ISO 8601
  source: "bot" | "freighter";
  tx_count: number;
}

/** Minimal fetch shape so tests can inject a fake without the DOM lib. */
export type FetchLike = (url: string) => Promise<{ ok: boolean; json(): Promise<any> }>;

const defaultFetch: FetchLike = (url) =>
  (globalThis as unknown as { fetch: FetchLike }).fetch(url);

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Serialize user rows to CSV (header + one line per user). */
export function buildUsersCsv(rows: UserRow[]): string {
  const header = "address,registered_at,source,tx_count";
  const lines = rows.map((r) =>
    [r.address, r.registered_at, r.source, String(r.tx_count)].map(csvEscape).join(",")
  );
  return [header, ...lines].join("\n") + "\n";
}

/** Count an account's transactions on Horizon. Returns 0 on any failure. */
async function fetchTxCount(
  address: string,
  horizonUrl: string,
  doFetch: FetchLike
): Promise<number> {
  try {
    const res = await doFetch(
      `${horizonUrl}/accounts/${encodeURIComponent(address)}/transactions?limit=200&order=desc`
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return data?._embedded?.records?.length ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Build the user rows from the registered bot + Freighter wallets, enriching
 * each with a live Horizon transaction count. Horizon lookups run in parallel.
 */
export async function collectUserRows(params: {
  botWallets: { publicKey: string; createdAt: Date }[];
  freighterWallets: { publicKey: string; connectedAt: Date }[];
  horizonUrl: string;
  fetchImpl?: FetchLike;
}): Promise<UserRow[]> {
  const doFetch = params.fetchImpl ?? defaultFetch;

  const base: Omit<UserRow, "tx_count">[] = [
    ...params.botWallets.map((w) => ({
      address: w.publicKey,
      registered_at: w.createdAt.toISOString(),
      source: "bot" as const,
    })),
    ...params.freighterWallets.map((w) => ({
      address: w.publicKey,
      registered_at: w.connectedAt.toISOString(),
      source: "freighter" as const,
    })),
  ];

  return Promise.all(
    base.map(async (b) => ({
      ...b,
      tx_count: await fetchTxCount(b.address, params.horizonUrl, doFetch),
    }))
  );
}
