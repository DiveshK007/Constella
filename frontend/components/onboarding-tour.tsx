"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Wallet, MousePointerClick, Workflow, Play, X, ArrowRight, ArrowLeft } from "lucide-react";

const DISMISS_KEY = "stellrflow_tour_dismissed";
const WORKFLOW_KEY = "stellrflow_workflow";

const STEPS = [
  {
    icon: Wallet,
    title: "Connect your wallet",
    body: "Click Connect Wallet in the top bar and pick Freighter, Albedo, or xBull. Your keys never leave your wallet.",
  },
  {
    icon: MousePointerClick,
    title: "Drag in a trigger",
    body: "Open the Nodes panel and drag a Trigger — like Telegram — onto the canvas. Triggers are where a workflow starts.",
  },
  {
    icon: Workflow,
    title: "Add & connect an action",
    body: "Drag an Action node (e.g. Send XLM or Check Balance), then click the trigger and the action to connect them.",
  },
  {
    icon: Play,
    title: "Run it",
    body: "Press Run. Each node executes in order and results show on the nodes. Successful runs are recorded on-chain.",
  },
];

export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // First-run only: show once when there is no saved workflow and the tour
  // hasn't been dismissed. Runs client-side so SSR renders nothing.
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY);
      const hasWorkflow = localStorage.getItem(WORKFLOW_KEY);
      if (!dismissed && !hasWorkflow) setOpen(true);
    } catch {
      /* localStorage unavailable — skip the tour */
    }
  }, []);

  const dismiss = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  if (!open) return null;

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={dismiss}
          aria-label="Skip tour"
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Getting started · Step {step + 1} of {STEPS.length}
        </div>

        <div className="mb-4 flex items-start gap-3">
          <div className="shrink-0 rounded-full bg-primary/10 p-2.5 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 id="tour-title" className="text-lg font-semibold text-foreground">
              {current.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{current.body}</p>
          </div>
        </div>

        {/* progress dots */}
        <div className="mb-5 flex items-center gap-1.5" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Link href="/docs" className="text-xs text-primary hover:underline" onClick={dismiss}>
            Read the full guide
          </Link>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={dismiss}>
                Get started
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep((s) => s + 1)}>
                Next
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
