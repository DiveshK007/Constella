import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Wallet,
  MousePointerClick,
  Workflow,
  Link2,
  Play,
  BarChart3,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Docs — Getting Started · StellrFlow",
  description: "A short getting-started guide for building your first Stellar workflow.",
};

const STEPS = [
  {
    icon: Wallet,
    title: "1. Connect your wallet",
    body: "Open Connect Wallet and choose Freighter, Albedo, or xBull. Your keys stay in your wallet — StellrFlow only ever requests signatures. On testnet you can fund a wallet from Friendbot.",
    href: "/connect-wallet",
    hrefLabel: "Connect a wallet →",
  },
  {
    icon: MousePointerClick,
    title: "2. Drag in a trigger",
    body: "On the workflow builder, open the Nodes panel and drag a Trigger onto the canvas — for example the Telegram trigger. Triggers are where a workflow begins.",
  },
  {
    icon: Workflow,
    title: "3. Add an action",
    body: "Drag an Action node onto the canvas, such as Send XLM or Check Balance. Click a node to configure it in the properties panel (destination, amount, chat ID, and so on).",
  },
  {
    icon: Link2,
    title: "4. Connect the nodes",
    body: "Click the trigger and then the action to connect them: Trigger → Action. Connections define the order steps run in.",
  },
  {
    icon: Play,
    title: "5. Run your workflow",
    body: "Press Run. Each node executes in sequence and results appear on the nodes. Stellar transactions are signed with your connected wallet.",
  },
  {
    icon: BarChart3,
    title: "6. Verify on-chain",
    body: "Every successful run is recorded on the WorkflowRegistry Soroban contract. Check the Metrics dashboard for live on-chain activity, or open a transaction on Stellar Expert.",
    href: "/metrics",
    hrefLabel: "Open the metrics dashboard →",
  },
];

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="outline" size="icon" className="shrink-0" aria-label="Back to builder">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-primary sm:text-3xl">Getting Started</h1>
            <p className="text-sm text-muted-foreground">
              Build and run your first Stellar workflow in a few minutes — no code required.
            </p>
          </div>
        </div>

        <Card className="bg-card">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            StellrFlow is a visual, drag-and-drop builder for automating Stellar
            transactions. You connect triggers, actions, and conditions on a canvas,
            then run them — with every workflow run logged on-chain. The steps below
            walk you through your first workflow.
          </CardContent>
        </Card>

        <div className="space-y-4">
          {STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.title} className="bg-card">
                <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
                  <div className="shrink-0 rounded-full bg-primary/10 p-2 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-base">{s.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p>{s.body}</p>
                  {s.href && (
                    <Link
                      href={s.href}
                      className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                    >
                      {s.hrefLabel}
                    </Link>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Next steps</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Link the Telegram bot with <code>/register</code> to run workflows and get
                notifications from chat.
              </li>
              <li>
                Save your workflow from the builder toolbar — it persists in your browser so
                you can reload it later.
              </li>
              <li>
                Track adoption and on-chain activity on the{" "}
                <Link href="/metrics" className="text-primary hover:underline">
                  Metrics dashboard
                </Link>
                .
              </li>
            </ul>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2 pb-4">
          <Link href="/">
            <Button size="sm">Open the builder</Button>
          </Link>
          <Link href="/connect-wallet">
            <Button size="sm" variant="outline">
              Connect a wallet
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
