"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Save,
  Upload,
  Download,
  Play,
  Settings,
  PanelLeft,
  PanelRight,
  Workflow,
  Wallet,
  Menu,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkflowStore } from "@/lib/stores/workflow-store";

export function NavBar() {
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { saveWorkflow, loadWorkflow, startWorkflow, isWorkflowRunning } = useWorkflowStore();

  // Sync panel highlight state when the canvas changes panel visibility (e.g. on resize)
  useEffect(() => {
    const onLeft  = (e: Event) => setLeftPanelOpen((e as CustomEvent).detail);
    const onRight = (e: Event) => setRightPanelOpen((e as CustomEvent).detail);
    document.addEventListener("panel-left-changed", onLeft);
    document.addEventListener("panel-right-changed", onRight);
    return () => {
      document.removeEventListener("panel-left-changed", onLeft);
      document.removeEventListener("panel-right-changed", onRight);
    };
  }, []);

  const handleSave = () => {
    saveWorkflow();
    toast.success("Workflow saved successfully");
  };

  const handleRun = async () => {
    toast.info("▶️ Workflow execution started...");
    try {
      await startWorkflow();
      toast.success("✅ Workflow executed successfully!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Workflow failed: ${msg}`);
    }
  };

  const toggleLeftPanel = () => {
    const next = !leftPanelOpen;
    setLeftPanelOpen(next);
    document.dispatchEvent(new CustomEvent('toggle-left-panel', { detail: next }));
  };

  const toggleRightPanel = () => {
    const next = !rightPanelOpen;
    setRightPanelOpen(next);
    document.dispatchEvent(new CustomEvent('toggle-right-panel', { detail: next }));
  };

  return (
    <nav className="border-b border-border bg-card p-3 md:p-4 flex justify-between items-center z-10 relative">
      <div className="flex items-center space-x-2">
        <Link href="/" className="flex items-center">
          <Image
            src="/logo.png"
            alt="StellarFlow Logo"
            width={32}
            height={32}
            className="md:w-[38px] md:h-[38px]"
          />
          <span className="text-lg md:text-xl font-semibold text-primary ml-1">StellarFlow</span>
        </Link>
      </div>

      {/* Mobile menu toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
      >
        {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Desktop nav items */}
      <div className="hidden md:flex items-center space-x-2">
        <Link href="/connect-wallet">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-primary/50 hover:bg-primary/10 text-primary"
            aria-label="Connect wallet"
          >
            <Wallet className="h-4 w-4" />
            Connect Wallet
          </Button>
        </Link>

        <Link href="/metrics">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-muted-foreground/50 hover:bg-muted"
            aria-label="View metrics dashboard"
          >
            <Settings className="h-4 w-4" />
            Metrics
          </Button>
        </Link>

        <Button
          variant="outline"
          size="icon"
          onClick={toggleLeftPanel}
          className={leftPanelOpen ? "bg-muted" : ""}
          aria-label="Toggle node sidebar"
          title="Toggle left panel"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={toggleRightPanel}
          className={rightPanelOpen ? "bg-muted" : ""}
          aria-label="Toggle properties panel"
          title="Toggle right panel"
        >
          <PanelRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-card border-b border-border p-3 flex flex-col gap-2 md:hidden z-50 shadow-lg">
          <Link href="/connect-wallet" onClick={() => setMobileMenuOpen(false)}>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 border-primary/50 hover:bg-primary/10 text-primary justify-start"
              aria-label="Connect wallet"
            >
              <Wallet className="h-4 w-4" />
              Connect Wallet
            </Button>
          </Link>

          <Link href="/metrics" onClick={() => setMobileMenuOpen(false)}>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 border-muted-foreground/50 hover:bg-muted justify-start"
              aria-label="View metrics dashboard"
            >
              <Settings className="h-4 w-4" />
              Metrics
            </Button>
          </Link>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { toggleLeftPanel(); setMobileMenuOpen(false); }}
              className={`flex-1 gap-2 justify-start ${leftPanelOpen ? "bg-muted" : ""}`}
              aria-label="Toggle node sidebar"
            >
              <PanelLeft className="h-4 w-4" />
              Nodes
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => { toggleRightPanel(); setMobileMenuOpen(false); }}
              className={`flex-1 gap-2 justify-start ${rightPanelOpen ? "bg-muted" : ""}`}
              aria-label="Toggle properties panel"
            >
              <PanelRight className="h-4 w-4" />
              Properties
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
}
