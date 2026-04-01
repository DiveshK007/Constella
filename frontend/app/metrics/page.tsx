"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Activity,
  Wallet,
  ArrowLeft,
  RefreshCw,
  Zap,
  Clock,
  BarChart3,
  Shield,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_STELLAR_BOT_URL || "http://localhost:3003";

interface MetricsData {
  uptime: string;
  users: {
    totalTelegramWallets: number;
    totalFreighterWallets: number;
    totalUsers: number;
    dailyActiveUsers: number;
  };
  activity: {
    totalRequests: number;
    totalCommands: number;
    totalWalletsCreated: number;
    totalTransactions: number;
    commandBreakdown: Record<string, number>;
  };
  system: {
    network: string;
    activeSessions: number;
    autoPayActive: number;
    startedAt: string;
  };
  recentRequests: { timestamp: string; method: string; path: string }[];
}

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BOT_URL}/api/metrics`);
      const data = await res.json();
      if (data.success) {
        setMetrics(data);
        setError(null);
      }
    } catch (err) {
      setError("Bot API unreachable. Make sure the bot is running on port 3003.");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
                <BarChart3 className="h-8 w-8" />
                Metrics Dashboard
              </h1>
              <p className="text-sm text-muted-foreground">
                Real-time monitoring for StellrFlow
              </p>
            </div>
          </div>
          <Button onClick={fetchMetrics} variant="outline" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
            ⚠️ {error}
          </div>
        )}

        {metrics && (
          <>
            {/* Top Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Total Users
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-primary">
                    {metrics.users.totalUsers}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {metrics.users.totalTelegramWallets} Telegram · {metrics.users.totalFreighterWallets} Freighter
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    DAU
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-green-400">
                    {metrics.users.dailyActiveUsers}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Daily Active Users
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Requests
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-blue-400">
                    {metrics.activity.totalRequests}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {metrics.activity.totalCommands} commands
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Uptime
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-yellow-400">
                    {metrics.uptime.split("h")[0]}h
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Since {new Date(metrics.system.startedAt).toLocaleTimeString()}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Second Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Command Breakdown */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">
                    Command Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(metrics.activity.commandBreakdown).length === 0 ? (
                    <p className="text-muted-foreground text-sm">No commands yet</p>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(metrics.activity.commandBreakdown)
                        .sort(([, a], [, b]) => b - a)
                        .map(([cmd, count]) => (
                          <div key={cmd} className="flex items-center justify-between">
                            <span className="text-sm font-mono text-primary">/{cmd}</span>
                            <div className="flex items-center gap-2">
                              <div
                                className="h-2 bg-primary/50 rounded"
                                style={{
                                  width: `${Math.min(count * 20, 200)}px`,
                                }}
                              />
                              <span className="text-sm text-muted-foreground w-8 text-right">
                                {count}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* System Status */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    System Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Network</span>
                    <span className="text-sm font-mono text-green-400 bg-green-500/10 px-2 py-0.5 rounded">
                      {metrics.system.network}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Active Sessions</span>
                    <span className="text-sm font-bold">{metrics.system.activeSessions}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">AutoPay Schedules</span>
                    <span className="text-sm font-bold">{metrics.system.autoPayActive}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Wallets Created</span>
                    <span className="text-sm font-bold">{metrics.activity.totalWalletsCreated}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Transactions</span>
                    <span className="text-sm font-bold">{metrics.activity.totalTransactions}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Requests */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">
                  Recent API Requests
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {metrics.recentRequests.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No requests yet</p>
                  ) : (
                    metrics.recentRequests
                      .slice()
                      .reverse()
                      .map((req, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 text-xs font-mono py-1 border-b border-border/50"
                        >
                          <span className="text-muted-foreground w-20 flex-shrink-0">
                            {new Date(req.timestamp).toLocaleTimeString()}
                          </span>
                          <span
                            className={`w-12 text-center rounded px-1 py-0.5 ${
                              req.method === "GET"
                                ? "bg-blue-500/10 text-blue-400"
                                : "bg-green-500/10 text-green-400"
                            }`}
                          >
                            {req.method}
                          </span>
                          <span className="text-foreground truncate">{req.path}</span>
                        </div>
                      ))
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {!metrics && !error && (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </div>
    </main>
  );
}
