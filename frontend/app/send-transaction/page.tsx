"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, CheckCircle2, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { getStoredAddress, isWalletConnected, signWithKit } from "@/lib/wallet-kit";

const STELLAR_BOT_URL = process.env.NEXT_PUBLIC_STELLAR_BOT_URL || "http://localhost:3003";

export default function SendTransactionPage() {
  const searchParams = useSearchParams();
  const chatId = searchParams.get("chatId");
  const prefillDestination = searchParams.get("destination") || "";
  const prefillAmount = searchParams.get("amount") || "";
  const network = searchParams.get("network") || "testnet";

  const [status, setStatus] = useState<"idle" | "loading" | "signing" | "success" | "error">("idle");
  const [destination, setDestination] = useState(prefillDestination);
  const [amount, setAmount] = useState(prefillAmount);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [walletConnected, setWalletConnected] = useState<boolean | null>(null);

  useEffect(() => {
    // The wallet is chosen on the connect page; here we reuse the stored address.
    const stored = getStoredAddress();
    if (stored) {
      setPublicKey(stored);
      setWalletConnected(true);
    } else {
      setWalletConnected(false);
    }
  }, []);

  const sendTransaction = async () => {
    if (!destination || !amount || !publicKey) {
      setError("Please fill in all fields and connect a wallet");
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Invalid amount");
      return;
    }

    setStatus("loading");
    setError(null);

    try {
      // Step 1: Build unsigned transaction on backend
      const buildResponse = await fetch(`${STELLAR_BOT_URL}/api/transaction/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceAddress: publicKey,
          destination,
          amount: amountNum.toFixed(7),
          network,
        }),
      });

      const buildResult = await buildResponse.json();
      if (!buildResult.success) {
        throw new Error(buildResult.error || "Failed to build transaction");
      }

      setStatus("signing");

      // Step 2: Sign with the connected wallet (Freighter / Albedo / xBull)
      const signedXdr = await signWithKit(buildResult.xdr, {
        networkPassphrase: network === "testnet"
          ? "Test SDF Network ; September 2015"
          : "Public Global Stellar Network ; September 2015",
        address: publicKey,
      });

      // Step 3: Submit signed transaction
      const submitResponse = await fetch(`${STELLAR_BOT_URL}/api/transaction/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedXdr,
          chatId,
          network,
        }),
      });

      const submitResult = await submitResponse.json();
      if (!submitResult.success) {
        throw new Error(submitResult.error || "Failed to submit transaction");
      }

      setTxHash(submitResult.hash);
      setStatus("success");

      // Notify Telegram
      if (chatId) {
        const message =
          `✅ **Transaction Successful!**\n\n` +
          `**Sent:** ${amount} XLM\n` +
          `**To:** \`${destination.slice(0, 8)}...${destination.slice(-8)}\`\n\n` +
          `🔗 [View on Explorer](https://stellar.expert/explorer/${network}/tx/${submitResult.hash})`;

        await fetch(`${STELLAR_BOT_URL}/api/telegram/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId, message }),
        });
      }
    } catch (err) {
      console.error("Transaction error:", err);
      setError(err instanceof Error ? err.message : "Transaction failed");
      setStatus("error");

      // Notify Telegram of failure
      if (chatId) {
        await fetch(`${STELLAR_BOT_URL}/api/telegram/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId,
            message: `❌ Transaction failed: ${err instanceof Error ? err.message : "Unknown error"}`,
          }),
        });
      }
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <Card className="rounded-2xl border-white/10 bg-card/70 shadow-2xl backdrop-blur-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full border border-white/10 bg-white/5">
              <Send className="h-8 w-8 text-foreground" />
            </div>
            <CardTitle className="font-display text-2xl">Send XLM</CardTitle>
            <CardDescription>Sign and send a transaction with your connected wallet</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {walletConnected === null ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8">
                <Loader2 className="h-8 w-8 animate-spin text-foreground" />
                <p className="text-sm text-muted-foreground">Checking wallet...</p>
              </div>
            ) : walletConnected === false ? (
              <div className="space-y-4">
                {/* Prompt — hueless (not an error) */}
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-muted-foreground">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <p className="text-sm">No wallet connected yet</p>
                </div>
                <Button onClick={() => (window.location.href = "/connect-wallet")} className="w-full">
                  Connect a Wallet
                </Button>
              </div>
            ) : status === "success" ? (
              <div className="space-y-4">
                {/* Transaction success — green (tx-status), with icon + text */}
                <div className="flex items-center gap-3 rounded-xl border border-green-500/25 bg-green-500/10 p-4 text-green-300">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Transaction Successful!</p>
                    <p className="font-mono text-xs opacity-90">{txHash?.slice(0, 16)}…</p>
                  </div>
                </div>
                <Button
                  onClick={() => window.open(`https://stellar.expert/explorer/${network}/tx/${txHash}`, "_blank")}
                  variant="outline"
                  className="w-full"
                >
                  View on Explorer
                </Button>
                {chatId && (
                  <p className="text-center text-sm text-muted-foreground">
                    ✅ Telegram notified! You can close this page.
                  </p>
                )}
              </div>
            ) : status === "error" ? (
              <div className="space-y-4">
                {/* Transaction failure / error — red, with icon + text */}
                <div className="flex items-center gap-3 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-red-300">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
                <Button onClick={() => setStatus("idle")} className="w-full">
                  Try Again
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {publicKey && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs text-muted-foreground">From</p>
                    <p className="truncate font-mono text-sm">{publicKey}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="destination">Destination Address</Label>
                  <Input
                    id="destination"
                    placeholder="GABC...XYZ"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    disabled={status !== "idle"}
                    className="font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (XLM)</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="10"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={status !== "idle"}
                  />
                </div>

                <Button
                  onClick={sendTransaction}
                  className="w-full"
                  disabled={status !== "idle" || !publicKey}
                >
                  {status === "loading" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Building Transaction...
                    </>
                  ) : status === "signing" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sign in your wallet...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send XLM
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  Network: {network} • You'll be prompted to sign in your wallet
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
}
