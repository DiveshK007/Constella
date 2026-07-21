import { buildUsersCsv, collectUserRows, type UserRow, type FetchLike } from "./usersExport.js";
import { requireAdminToken } from "./middleware/security.js";
import type { Request, Response, NextFunction } from "express";

describe("buildUsersCsv", () => {
  it("renders a header row plus one line per user", () => {
    const rows: UserRow[] = [
      { address: "GBOT", registered_at: "2026-07-01T00:00:00.000Z", source: "bot", tx_count: 3 },
      { address: "GFREI", registered_at: "2026-07-02T00:00:00.000Z", source: "freighter", tx_count: 0 },
    ];
    const lines = buildUsersCsv(rows).trim().split("\n");
    expect(lines[0]).toBe("address,registered_at,source,tx_count");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe("GBOT,2026-07-01T00:00:00.000Z,bot,3");
    expect(lines[2]).toBe("GFREI,2026-07-02T00:00:00.000Z,freighter,0");
  });

  it("returns only the header when there are no users", () => {
    expect(buildUsersCsv([]).trim()).toBe("address,registered_at,source,tx_count");
  });
});

describe("collectUserRows", () => {
  it("merges bot + freighter wallets and enriches each with a live tx_count", async () => {
    const fetchImpl: FetchLike = jest.fn(async (url: string) => ({
      ok: true,
      json: async () => ({ _embedded: { records: url.includes("GBOT") ? [{}, {}] : [] } }),
    }));

    const rows = await collectUserRows({
      botWallets: [{ publicKey: "GBOT", createdAt: new Date("2026-07-01T00:00:00Z") }],
      freighterWallets: [{ publicKey: "GFREI", connectedAt: new Date("2026-07-02T00:00:00Z") }],
      horizonUrl: "https://horizon.test",
      fetchImpl,
    });

    expect(rows).toHaveLength(2);
    const bot = rows.find((r) => r.source === "bot")!;
    const frei = rows.find((r) => r.source === "freighter")!;
    expect(bot.address).toBe("GBOT");
    expect(bot.tx_count).toBe(2);
    expect(frei.address).toBe("GFREI");
    expect(frei.tx_count).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("uses tx_count 0 when Horizon fails — never a fabricated number", async () => {
    const fetchImpl: FetchLike = jest.fn(async () => {
      throw new Error("horizon unreachable");
    });
    const rows = await collectUserRows({
      botWallets: [{ publicKey: "GX", createdAt: new Date() }],
      freighterWallets: [],
      horizonUrl: "https://horizon.test",
      fetchImpl,
    });
    expect(rows[0].tx_count).toBe(0);
  });
});

describe("requireAdminToken", () => {
  function mockRes() {
    const res: Partial<Response> & { statusCode?: number; body?: unknown } = {};
    res.status = jest.fn((code: number) => {
      res.statusCode = code;
      return res as Response;
    }) as unknown as Response["status"];
    res.json = jest.fn((b: unknown) => {
      res.body = b;
      return res as Response;
    }) as unknown as Response["json"];
    return res;
  }

  const OLD = process.env.ADMIN_TOKEN;
  afterEach(() => {
    if (OLD === undefined) delete process.env.ADMIN_TOKEN;
    else process.env.ADMIN_TOKEN = OLD;
  });

  it("returns 503 (disabled) when ADMIN_TOKEN is not configured", () => {
    delete process.env.ADMIN_TOKEN;
    const res = mockRes();
    const next = jest.fn();
    requireAdminToken({ headers: {} } as Request, res as Response, next as NextFunction);
    expect(res.statusCode).toBe(503);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when the token is missing or wrong", () => {
    process.env.ADMIN_TOKEN = "secret";
    const res = mockRes();
    const next = jest.fn();
    requireAdminToken({ headers: { "x-admin-token": "nope" } } as unknown as Request, res as Response, next as NextFunction);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() when the token matches (header or bearer)", () => {
    process.env.ADMIN_TOKEN = "secret";
    const next = jest.fn();
    requireAdminToken({ headers: { "x-admin-token": "secret" } } as unknown as Request, mockRes() as Response, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);

    const next2 = jest.fn();
    requireAdminToken({ headers: { authorization: "Bearer secret" } } as unknown as Request, mockRes() as Response, next2 as NextFunction);
    expect(next2).toHaveBeenCalledTimes(1);
  });
});
