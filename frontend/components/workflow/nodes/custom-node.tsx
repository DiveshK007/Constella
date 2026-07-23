"use client";

import { Handle, Position, NodeProps } from "@reactflow/core";
import { motion } from "framer-motion";
import { NodeData, useWorkflowStore } from "@/lib/stores/workflow-store";
import { getIconByName } from "@/lib/utils/icons";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  Play,
  GitBranch,
  type LucideIcon,
} from "lucide-react";

type Category = "trigger" | "action" | "logic";

// Categories are distinguished WITHOUT colour — a category icon, a border
// weight/style, and a text label carry the meaning.
const CATEGORY: Record<Category, { label: string; icon: LucideIcon; border: string }> = {
  trigger: { label: "Trigger", icon: Zap, border: "border-2 border-white/25" },
  action: { label: "Action", icon: Play, border: "border border-white/15" },
  logic: { label: "Logic", icon: GitBranch, border: "border border-dashed border-white/30" },
};

function getCategory(type: string): Category {
  if (type.includes("trigger")) return "trigger";
  if (type === "delay") return "logic";
  return "action";
}

export function CustomNode({ data, id, selected }: NodeProps<NodeData>) {
  const Icon = getIconByName(data.icon);
  const { nodeExecutionState } = useWorkflowStore();
  const nodeState = nodeExecutionState[id];

  const cat = CATEGORY[getCategory(data.type)];
  const CatIcon = cat.icon;

  function renderStateIndicator() {
    switch (nodeState) {
      case "pending":
        return <Clock className="h-4 w-4 animate-pulse text-muted-foreground" />;
      case "running":
        // In-progress is hueless; only tx success/failure use colour.
        return <Loader2 className="h-4 w-4 animate-spin text-foreground" />;
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  }

  return (
    <motion.div
      initial={{ scale: 0.92, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`relative w-56 rounded-xl shadow-sm transition-shadow duration-200 hover:shadow-glow-sm ${cat.border} ${
        selected ? "ring-2 ring-white/70 ring-offset-2 ring-offset-background" : ""
      }`}
    >
      {/* Decorative glass fill on a non-interactive layer BEHIND the content.
          The blur/overflow must never live on the element that hosts the
          <Handle>s, or backdrop-filter clipping eats the connection hit-tests. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 rounded-xl bg-card/80 backdrop-blur-sm"
      />

      {/* Category eyebrow — icon + label (no colour) + execution status */}
      <div className="flex items-center gap-1.5 px-3 pt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        <CatIcon className="h-3 w-3" />
        <span>{cat.label}</span>
        <span className="ml-auto">{renderStateIndicator()}</span>
      </div>

      {/* Node identity */}
      <div className="flex items-center gap-2 px-3 pt-1 font-medium text-foreground">
        <span className="text-foreground/90">{Icon}</span>
        <span className="truncate">{data.label}</span>
      </div>

      <div className="px-3 pb-3 pt-1 text-xs text-muted-foreground">{data.description}</div>

      {/* Handles: direct, unclipped children so ReactFlow can hit-test them. */}
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        className="!-left-1.5 !h-3 !w-3 !border-2 !border-background !bg-foreground"
        isConnectable
      />
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        className="!-right-1.5 !h-3 !w-3 !border-2 !border-background !bg-foreground"
        isConnectable
      />
    </motion.div>
  );
}
