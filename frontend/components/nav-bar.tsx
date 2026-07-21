"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Settings,
  PanelLeft,
  PanelRight,
  Workflow,
  Wallet,
  BookOpen,
  Menu,
  X,
} from "lucide-react";

export function NavBar() {
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sync panel highlight state when the canvas changes panel visibility (e.g. on resize)
  useEffect(() => {
    const onLeft = (e: Event) => setLeftPanelOpen((e as CustomEvent).detail);
    const onRight = (e: Event) => setRightPanelOpen((e as CustomEvent).detail);
    document.addEventListener("panel-left-changed", onLeft);
    document.addEventListener("panel-right-changed", onRight);
    return () => {
      document.removeEventListener("panel-left-changed", onLeft);
      document.removeEventListener("panel-right-changed", onRight);
    };
  }, []);

  const toggleLeftPanel = () => {
    const next = !leftPanelOpen;
    setLeftPanelOpen(next);
    document.dispatchEvent(new CustomEvent("toggle-left-panel", { detail: next }));
  };

  const toggleRightPanel = () => {
    const next = !rightPanelOpen;
    setRightPanelOpen(next);
    document.dispatchEvent(new CustomEvent("toggle-right-panel", { detail: next }));
  };

  return (
    <nav className="relative z-20 flex items-center justify-between border-b border-white/10 glass px-3 py-2.5 md:px-4 md:py-3">
      {/* Wordmark — monochrome mark + StellrFlow */}
      <Link href="/" className="flex items-center gap-2" aria-label="StellrFlow home">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-white/15 bg-white/5">
          <Workflow className="h-4 w-4 text-foreground" />
        </span>
        <span className="font-display text-lg font-semibold tracking-tight text-foreground md:text-xl">
          StellrFlow
        </span>
      </Link>

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
      <div className="hidden items-center gap-2 md:flex">
        <Link href="/connect-wallet">
          <Button
            size="sm"
            className="gap-2 border border-white/10 bg-secondary text-foreground hover:bg-muted"
            aria-label="Connect wallet"
          >
            <Wallet className="h-4 w-4" />
            Connect Wallet
          </Button>
        </Link>

        <Link href="/docs">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground" aria-label="Read the docs">
            <BookOpen className="h-4 w-4" />
            Docs
          </Button>
        </Link>

        <Link href="/metrics">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground" aria-label="View metrics dashboard">
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
        <div className="absolute left-0 right-0 top-full z-50 flex flex-col gap-2 border-b border-white/10 glass-strong p-3 md:hidden">
          <Link href="/connect-wallet" onClick={() => setMobileMenuOpen(false)}>
            <Button size="sm" className="w-full justify-start gap-2 border border-white/10 bg-secondary text-foreground hover:bg-muted" aria-label="Connect wallet">
              <Wallet className="h-4 w-4" />
              Connect Wallet
            </Button>
          </Link>

          <Link href="/docs" onClick={() => setMobileMenuOpen(false)}>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground" aria-label="Read the docs">
              <BookOpen className="h-4 w-4" />
              Docs
            </Button>
          </Link>

          <Link href="/metrics" onClick={() => setMobileMenuOpen(false)}>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground" aria-label="View metrics dashboard">
              <Settings className="h-4 w-4" />
              Metrics
            </Button>
          </Link>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { toggleLeftPanel(); setMobileMenuOpen(false); }}
              className={`flex-1 justify-start gap-2 ${leftPanelOpen ? "bg-muted" : ""}`}
              aria-label="Toggle node sidebar"
            >
              <PanelLeft className="h-4 w-4" />
              Nodes
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => { toggleRightPanel(); setMobileMenuOpen(false); }}
              className={`flex-1 justify-start gap-2 ${rightPanelOpen ? "bg-muted" : ""}`}
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
