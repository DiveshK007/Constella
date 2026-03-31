"use client";

import { useState } from "react";
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
  Wallet
} from "lucide-react";
import { toast } from "sonner";
import { useWorkflowStore } from "@/lib/stores/workflow-store";

export function NavBar() {
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  const { saveWorkflow, loadWorkflow, startWorkflow, isWorkflowRunning } = useWorkflowStore();

  const handleSave = () => {
    saveWorkflow();
    toast.success("Workflow saved successfully");
  };

  const handleRun = async () => {
    toast.info("▶️ Workflow execution started...");
    try {
      await startWorkflow();
      toast.success("✅ Workflow executed successfully!");
    } catch (err: any) {
      toast.error(`❌ Workflow failed: ${err.message}`);
    }
  };

  const toggleLeftPanel = () => {
    setLeftPanelOpen(!leftPanelOpen);
    document.dispatchEvent(new CustomEvent('toggle-left-panel', { detail: !leftPanelOpen }));
  };

  const toggleRightPanel = () => {
    setRightPanelOpen(!rightPanelOpen);
    document.dispatchEvent(new CustomEvent('toggle-right-panel', { detail: !rightPanelOpen }));
  };

  return (
    <nav className="border-b border-border bg-card p-4 flex justify-between items-center z-10">
      <div className="flex items-center space-x-2">
        <Link href="/" className="flex items-center">
          <Image
            src="/logo.png"
            alt="StellarFlow Logo"
            width={38}
            height={38}
          // className="mr-2"
          />
          <span className="text-xl font-semibold text-primary">StellarFlow</span>
        </Link>
      </div>

      <div className="flex items-center space-x-2">
        <Link href="/connect-wallet">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-primary/50 hover:bg-primary/10 text-primary"
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
          title="Toggle left panel"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={toggleRightPanel}
          className={rightPanelOpen ? "bg-muted" : ""}
          title="Toggle right panel"
        >
          <PanelRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}