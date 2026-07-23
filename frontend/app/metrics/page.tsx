"use client";
// Live metrics — every number on this page is fetched from the Stellar network
// at runtime. Nothing is hardcoded or faked: when a fetch fails we render 0 or
// an explicit "no data yet" empty state, never a fabricated fallback.
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  RefreshCw,
  Activity,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
  GitBranch,
  Wallet,
  Code2,
  Download,
} from "lucide-react";
import {
  HORIZON_URL,
  STELLAR_EXPERT_URL as STELLAR_EXPERT,
  STELLAR_NETWORK,
} from "@/lib/stellar-network";
import {
  fetchExecutionCount,
  WORKFLOW_REGISTRY_CONTRACT_ID as CONTRACT_ID,
} from "@/lib/workflow-registry";

// ── Constants ────────────────────────────────────────────────────────────────

// The app's operational account, whose on-chain activity this dashboard reports.
const BOT_WALLET = "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGKWD36ONSTNXABUABT56UQ";
const TX_FETCH_LIMIT = 200;
const NETWORK_LABEL = STELLAR_NETWORK === "mainnet" ? "Mainnet" : "Testnet";

// recharts is heavy; load it lazily so it stays out of the metrics page's
// initial bundle and only downloads once a chart actually renders.
const TxBarChart = dynamic(() => import("@/components/metrics/tx-bar-chart"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">
      Loading chart…
    </div>
  ),
});

// ── Types ────────────────────────────────────────────────────────────────────

interface TxRow {
  hash: string;
  timestamp: string;
  successful: boolean;
  operationCount: number;
}

interface DayBucket {
  day: string;
  count: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function truncateHash(hash: string, chars = 8) {
  return `${hash.slice(0, chars)}…${hash.slice(-chars)}`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Workflow runs are tracked locally in the browser; there is no fabricated
// default — an absent/empty store simply means 0 runs.
function readWorkflowCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const arr = localStorage.getItem("stellrflow_executions");
    if (arr) {
      const parsed = JSON.parse(arr);
      return Array.isArray(parsed) ? parsed.length : 0;
    }
    const n = parseInt(localStorage.getItem("stellrflow_run_count") ?? "", 10);
    return isNaN(n) ? 0 : n;
  } catch {
    return 0;
  }
}

// Bucket real transaction timestamps into the last 7 calendar days (UTC).
function buildDailySeries(txs: TxRow[]): DayBucket[] {
  const days: { day: string; count: number; key: string }[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(now.getUTCDate() - i);
    days.push({
      day: d.toLocaleDateString(undefined, { weekday: "short" }),
      count: 0,
      key: d.toISOString().slice(0, 10),
    });
  }
  for (const tx of txs) {
    const key = new Date(tx.timestamp).toISOString().slice(0, 10);
    const bucket = days.find((b) => b.key === key);
    if (bucket) bucket.count++;
  }
  return days.map(({ day, count }) => ({ day, count }));
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MetricsPage() {
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [txCount, setTxCount] = useState(0);
  const [dailyTx, setDailyTx] = useState<DayBucket[]>([]);
  const [executionCount, setExecutionCount] = useState<number | null>(null);
  const [workflowCount, setWorkflowCount] = useState(0);
  const [txLoading, setTxLoading] = useState(true);
  const [contractLoading, setContractLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setRefreshing(true);

    // Workflow runs tracked locally in this browser (always succeeds).
    setWorkflowCount(readWorkflowCount());

    // ── Horizon: real transactions for the app account ────────────────────────
    // On any failure we reset to empty — no fabricated fallback.
    setTxLoading(true);
    try {
      const res = await fetch(
        `${HORIZON_URL}/accounts/${BOT_WALLET}/transactions?limit=${TX_FETCH_LIMIT}&order=desc`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (res.ok) {
        const data = await res.json();
        const records: any[] = data._embedded?.records ?? [];
        const rows: TxRow[] = records.map((tx: any) => ({
          hash: tx.hash,
          timestamp: tx.created_at,
          successful: tx.successful,
          operationCount: tx.operation_count,
        }));
        setTransactions(rows);
        setTxCount(rows.length);
        setDailyTx(buildDailySeries(rows));
      } else {
        setTransactions([]);
        setTxCount(0);
        setDailyTx(buildDailySeries([]));
      }
    } catch {
      // Horizon unreachable/timed out — show the empty state, not a fake number.
      setTransactions([]);
      setTxCount(0);
      setDailyTx(buildDailySeries([]));
    } finally {
      setTxLoading(false);
    }

    // ── Soroban RPC: WorkflowRegistry get_count ───────────────────────────────
    // null == unavailable -> the UI renders "no data yet", never a fake count.
    setContractLoading(true);
    setExecutionCount(await fetchExecutionCount());
    setContractLoading(false);

    setLastUpdated(new Date());
    setRefreshing(false);
  }, []);

  // Initial load + 30-second auto-refresh.
  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const handleExportCsv = () => {
    let csv = "Hash,Timestamp,Successful,Operations\n";
    transactions.forEach((tx) => {
      csv += `${tx.hash},${tx.timestamp},${tx.successful},${tx.operationCount}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "stellrflow_transactions.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Rendered value for the on-chain execution count (get_count).
  const executionDisplay =
    executionCount === null ? "—" : executionCount.toLocaleString();

  const statCards = [
    {
      title: "On-chain Transactions",
      value: txCount.toLocaleString(),
      sub: `for the app account · Horizon ${NETWORK_LABEL}`,
      icon: <Wallet className="h-4 w-4" />,
      loading: txLoading,
    },
    {
      title: "Contract Executions",
      value: executionDisplay,
      sub:
        executionCount === null
          ? "no data yet — WorkflowRegistry get_count"
          : "WorkflowRegistry get_count (on-chain)",
      icon: <Code2 className="h-4 w-4" />,
      loading: contractLoading,
    },
    {
      title: "Workflows Run",
      value: workflowCount.toLocaleString(),
      sub: "tracked locally in this browser",
      icon: <GitBranch className="h-4 w-4" />,
      loading: false,
    },
  ];

  const hasDailyTx = dailyTx.some((d) => d.count > 0);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="icon" className="shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-foreground sm:text-3xl">
                <BarChart3 className="h-7 w-7" />
                Metrics Dashboard
              </h1>
              <p className="text-sm text-muted-foreground">
                Live data from Stellar Horizon {NETWORK_LABEL}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={transactions.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Data sources note */}
        <div className="flex flex-col items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground md:flex-row">
          <div>
            <span className="font-semibold text-foreground mr-1">Data Sources:</span>
            <span>
              On-chain transactions from Stellar Horizon ({NETWORK_LABEL}) and
              WorkflowRegistry executions via Soroban RPC. Workflow runs are
              tracked locally in your browser.
            </span>
          </div>
        </div>

        {/* Stat grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {statCards.map((stat, i) => (
            <Card key={i} className="rounded-2xl border-white/10 bg-card/70 shadow-xl backdrop-blur-xl">
              <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {stat.title}
                </CardTitle>
                <div className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-foreground">
                  {stat.icon}
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-3xl font-bold text-foreground">
                  {stat.loading ? <Skeleton className="h-9 w-20" /> : stat.value}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Live Transaction Feed */}
        <Card className="rounded-2xl border-white/10 bg-card/70 shadow-xl backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Activity className="h-4 w-4" />
                Live Transaction Feed
              </span>
              <a
                href={`${STELLAR_EXPERT}/account/${BOT_WALLET}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline font-normal"
              >
                {BOT_WALLET.slice(0, 6)}…{BOT_WALLET.slice(-6)}
                <ExternalLink className="h-3 w-3" />
              </a>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {txLoading ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Fetching from Horizon…
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2">
                <p className="text-sm text-muted-foreground">
                  No transactions on record for this wallet yet.
                </p>
                <a
                  href={`${STELLAR_EXPERT}/account/${BOT_WALLET}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  View on Stellar Expert <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/60 text-muted-foreground">
                      <th className="text-left py-2 pr-3 font-medium">Tx Hash</th>
                      <th className="text-left py-2 pr-3 font-medium hidden sm:table-cell">Ops</th>
                      <th className="text-left py-2 pr-3 font-medium hidden sm:table-cell">Age</th>
                      <th className="text-left py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.slice(0, 15).map((tx) => (
                      <tr
                        key={tx.hash}
                        className="border-b border-border/30 hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-2 pr-3">
                          <a
                            href={`${STELLAR_EXPERT}/tx/${tx.hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-primary hover:underline flex items-center gap-1"
                          >
                            {truncateHash(tx.hash, 6)}
                            <ExternalLink className="h-2.5 w-2.5 opacity-60 shrink-0" />
                          </a>
                        </td>
                        <td className="py-2 pr-3 text-foreground hidden sm:table-cell">
                          {tx.operationCount}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground hidden sm:table-cell">
                          {timeAgo(tx.timestamp)}
                        </td>
                        <td className="py-2">
                          {tx.successful ? (
                            <span className="flex items-center gap-1 text-green-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span className="hidden xs:inline">Success</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-400">
                              <XCircle className="h-3.5 w-3.5" />
                              <span className="hidden xs:inline">Failed</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* On-chain transactions — last 7 days (derived from real tx timestamps) */}
        <Card className="rounded-2xl border-white/10 bg-card/70 shadow-xl backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              On-chain Transactions — Last 7 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            {txLoading ? (
              <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Fetching from Horizon…
              </div>
            ) : !hasDailyTx ? (
              <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">
                No transactions in the last 7 days yet.
              </div>
            ) : (
              <TxBarChart data={dailyTx} />
            )}
          </CardContent>
        </Card>

        {/* Contract Activity */}
        <Card className="rounded-2xl border-white/10 bg-card/70 shadow-xl backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Code2 className="h-4 w-4" />
              WorkflowRegistry Contract Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Contract ID</p>
                  <a
                    href={`${STELLAR_EXPERT}/contract/${CONTRACT_ID}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-primary hover:underline flex items-center gap-1 break-all"
                  >
                    {CONTRACT_ID}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Network</p>
                  <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-xs text-muted-foreground">
                    Stellar {NETWORK_LABEL}
                  </span>
                </div>
              </div>

              <div className="flex gap-4 sm:gap-10 shrink-0">
                <div className="text-center">
                  <p className="text-3xl font-bold text-foreground">
                    {contractLoading ? "…" : executionDisplay}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Executions</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary">
                    {txLoading ? "…" : txCount.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">On-chain Txs</p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap gap-2">
              <a
                href={`${STELLAR_EXPERT}/contract/${CONTRACT_ID}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <ExternalLink className="h-3 w-3" />
                  View on Stellar Expert
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-muted-foreground pb-2">
          <span>
            Data sourced from Stellar Horizon {NETWORK_LABEL} · Auto-refreshes every 30s
          </span>
          {lastUpdated && (
            <span className="flex items-center gap-1 shrink-0">
              <Clock className="h-3 w-3" />
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>

      </div>
    </main>
  );
}
