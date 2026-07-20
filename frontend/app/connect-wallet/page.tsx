"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import {
  connectWallet,
  getKitNetwork,
  getStoredAddress,
  isWalletConnected,
} from "@/lib/wallet-kit";
import { capture } from "@/lib/posthog";

const STELLAR_BOT_URL = process.env.NEXT_PUBLIC_STELLAR_BOT_URL || "http://localhost:3003";

/** Normalise a wallet-reported network string to the backend's enum. */
function normalizeNetwork(raw: string | null): "testnet" | "mainnet" {
  return (raw || "").toUpperCase().includes("PUBLIC") ? "mainnet" : "testnet";
}

export default function ConnectWalletPage() {
  const searchParams = useSearchParams();
  const chatId = searchParams.get("chatId");

  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Register wallet with backend and send confirmation to Telegram.
  const registerWalletWithBackend = async (key: string, network: "testnet" | "mainnet") => {
    // Fires for every wallet type the kit can connect (Freighter/Albedo/xBull).
    capture("wallet_connected", { network });

    if (!chatId) return;

    try {
      const registerResponse = await fetch(`${STELLAR_BOT_URL}/api/freighter/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, publicKey: key, network }),
      });
      const registerResult = await registerResponse.json();
      console.log("Wallet registration result:", registerResult);
    } catch (e) {
      console.error("Failed to register wallet:", e);
    }

    const message =
      `✅ *Wallet Connected!*\n\n` +
      `*Address:*\n\`${key}\`\n\n` +
      `🌐 *Network:* ${network}\n\n` +
      `*Available Commands:*\n` +
      `/mybalance - Check your wallet balance\n` +
      `/mywallet - Show your full address\n` +
      `/send <address> <amount> - Send XLM\n` +
      `/disconnect - Disconnect this wallet\n` +
      `/status - View your wallet status`;

    try {
      await fetch(`${STELLAR_BOT_URL}/api/telegram/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, message, parseMode: "Markdown" }),
      });
    } catch (e) {
      console.error("Failed to send Telegram message:", e);
    }
  };

  const finishConnected = async (address: string) => {
    setPublicKey(address);
    setStatus("connected");
    const network = normalizeNetwork(await getKitNetwork());
    await registerWalletWithBackend(address, network);
    setTimeout(() => {
      window.location.href = "/";
    }, 3000);
  };

  // Auto-reconnect if a wallet was connected in a previous session.
  useEffect(() => {
    if (isWalletConnected()) {
      const stored = getStoredAddress();
      if (stored) void finishConnected(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = async () => {
    setStatus("connecting");
    setError(null);
    try {
      // Opens the kit's picker showing Freighter, Albedo and xBull.
      const { address } = await connectWallet();
      if (!address) throw new Error("No address returned from wallet.");
      await finishConnected(address);
    } catch (err) {
      console.error("Wallet connection error:", err);
      setError(err instanceof Error ? err.message : "Failed to connect wallet. Please try again.");
      setStatus("error");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Wallet className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Connect Wallet</CardTitle>
          <CardDescription>
            Connect Freighter, Albedo, or xBull to interact with Stellar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "connected" ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-4 rounded-lg bg-green-500/10 text-green-500">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Wallet Connected!</p>
                  <p className="text-xs opacity-80 font-mono">
                    {publicKey?.slice(0, 12)}...{publicKey?.slice(-12)}
                  </p>
                </div>
              </div>
              <p className="text-sm text-center text-muted-foreground">
                Redirecting to dashboard in 3 seconds...
              </p>
              <Button onClick={() => (window.location.href = "/")} className="w-full">
                Go to Dashboard →
              </Button>
              {chatId && (
                <p className="text-sm text-center text-muted-foreground">
                  ✅ Telegram notified! You can also return to Telegram.
                </p>
              )}
            </div>
          ) : status === "error" ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-4 rounded-lg bg-red-500/10 text-red-500">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
              <Button onClick={handleConnect} className="w-full">
                Try Again
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {chatId && (
                <p className="text-sm text-center text-muted-foreground">
                  Connecting wallet for Telegram chat
                </p>
              )}
              <Button onClick={handleConnect} className="w-full" disabled={status === "connecting"}>
                {status === "connecting" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Choose a wallet...
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4 mr-2" />
                    Connect Wallet
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Supports Freighter, Albedo and xBull.
              </p>
            </div>
          )}

          <div className="pt-4 border-t">
            <p className="text-xs text-center text-muted-foreground">
              By connecting, you allow StellrFlow to request transaction signatures.
              Your private keys never leave your wallet.
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
