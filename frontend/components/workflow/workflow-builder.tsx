"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
    ReactFlow,
    ReactFlowProvider,
    useReactFlow,
    Panel,
    Connection,
    OnConnect,
    ConnectionLineType,
} from "@reactflow/core";
import { Background } from "@reactflow/background";
import { Controls } from "@reactflow/controls";
import { MiniMap } from "@reactflow/minimap";
import { useWorkflowStore, WorkflowNode, WorkflowEdge } from "@/lib/stores/workflow-store";
import { NodeTypesSidebar } from "./node-types-sidebar";
import { PropertiesPanel } from "./properties-panel";
import { CustomNode } from "./nodes/custom-node";
import { Button } from "@/components/ui/button";
import { Play, Square, Save, Download, ExternalLink, Loader2, Link2 } from "lucide-react";
import { ShinyText } from "@/components/motion/shiny-text";
import { motion } from "framer-motion";
import "@reactflow/core/dist/style.css";

const nodeTypes = {
    customNode: CustomNode,
};

/** Check if viewport is mobile-sized */
function useIsMobile(breakpoint = 768) {
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < breakpoint);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, [breakpoint]);
    return isMobile;
}

function WorkflowCanvas() {
    const {
        nodes,
        edges,
        onNodesChange,
        onEdgesChange,
        addEdge,
        setSelectedNode,
        setSelectedEdge,
        isWorkflowRunning,
        startWorkflow,
        stopWorkflow,
        saveWorkflow,
        loadWorkflow,
        lastExecutionLog,
    } = useWorkflowStore();

    const reactFlowInstance = useReactFlow();
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const isMobile = useIsMobile();

    // Default panels hidden on mobile, visible on desktop
    const [leftPanelVisible, setLeftPanelVisible] = useState(true);
    const [rightPanelVisible, setRightPanelVisible] = useState(true);

    // Auto-collapse panels on mobile — notify NavBar so its highlight stays in sync
    useEffect(() => {
        const left  = !isMobile;
        const right = !isMobile;
        setLeftPanelVisible(left);
        setRightPanelVisible(right);
        document.dispatchEvent(new CustomEvent("panel-left-changed",  { detail: left }));
        document.dispatchEvent(new CustomEvent("panel-right-changed", { detail: right }));
    }, [isMobile]);

    // Handle panel toggling from NavBar
    useEffect(() => {
        const handleToggleLeftPanel = (e: CustomEvent) => {
            setLeftPanelVisible(e.detail);
        };

        const handleToggleRightPanel = (e: CustomEvent) => {
            setRightPanelVisible(e.detail);
        };

        document.addEventListener(
            "toggle-left-panel",
            handleToggleLeftPanel as EventListener
        );
        document.addEventListener(
            "toggle-right-panel",
            handleToggleRightPanel as EventListener
        );

        return () => {
            document.removeEventListener(
                "toggle-left-panel",
                handleToggleLeftPanel as EventListener
            );
            document.removeEventListener(
                "toggle-right-panel",
                handleToggleRightPanel as EventListener
            );
        };
    }, []);

    // Load workflow on component mount
    useEffect(() => {
        loadWorkflow();
    }, [loadWorkflow]);

    const onConnect = useCallback<OnConnect>(
        (connection) => {
            if (connection.source && connection.target) {
                addEdge({
                    source: connection.source,
                    sourceHandle: connection.sourceHandle,
                    target: connection.target,
                    targetHandle: connection.targetHandle,
                });
            }
        },
        [addEdge]
    );

    const onNodeClick = useCallback(
        (_: React.MouseEvent, node: WorkflowNode) => {
            setSelectedNode(node);
            setSelectedEdge(null);
            // On mobile, auto-open properties panel when a node is selected
            if (isMobile) {
                setRightPanelVisible(true);
                setLeftPanelVisible(false);
                document.dispatchEvent(new CustomEvent("panel-right-changed", { detail: true }));
                document.dispatchEvent(new CustomEvent("panel-left-changed",  { detail: false }));
            }
        },
        [setSelectedNode, setSelectedEdge, isMobile]
    );

    const onEdgeClick = useCallback(
        (_: React.MouseEvent, edge: WorkflowEdge) => {
            setSelectedEdge(edge);
            setSelectedNode(null);
        },
        [setSelectedEdge, setSelectedNode]
    );

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            if (!reactFlowWrapper.current || !reactFlowInstance) return;

            const reactFlowBounds =
                reactFlowWrapper.current.getBoundingClientRect();
            const nodeType = event.dataTransfer.getData(
                "application/reactflow"
            );

            // Check if the dropped element is valid
            if (!nodeType || typeof nodeType !== "string") {
                return;
            }

            const position = reactFlowInstance.project({
                x: event.clientX - reactFlowBounds.left,
                y: event.clientY - reactFlowBounds.top,
            });

            // Add the new node
            useWorkflowStore.getState().addNode(nodeType, position);
        },
        [reactFlowInstance]
    );

    const onPaneClick = useCallback(() => {
        setSelectedNode(null);
        setSelectedEdge(null);
        // On mobile, close panels when tapping canvas
        if (isMobile) {
            setLeftPanelVisible(false);
            setRightPanelVisible(false);
            document.dispatchEvent(new CustomEvent("panel-left-changed",  { detail: false }));
            document.dispatchEvent(new CustomEvent("panel-right-changed", { detail: false }));
        }
    }, [setSelectedNode, setSelectedEdge, isMobile]);

    const handleStartWorkflow = useCallback(() => {
        startWorkflow();
    }, [startWorkflow]);

    const handleStopWorkflow = useCallback(() => {
        stopWorkflow();
    }, [stopWorkflow]);

    const handleSaveWorkflow = useCallback(() => {
        saveWorkflow();
    }, [saveWorkflow]);

    const handleLoadWorkflow = useCallback(() => {
        loadWorkflow();
    }, [loadWorkflow]);

    // Mobile overlay panel styles
    const mobilePanelBase = "fixed top-0 bottom-0 z-40 shadow-2xl transition-transform duration-200";

    return (
        <div ref={reactFlowWrapper} className="h-full w-full flex relative">
            {/* Left sidebar — overlay on mobile, inline on desktop */}
            {leftPanelVisible && (
                <>
                    {isMobile && (
                        <div
                            className="fixed inset-0 bg-black/40 z-30"
                            onClick={() => setLeftPanelVisible(false)}
                        />
                    )}
                    <div className={isMobile ? `${mobilePanelBase} left-0 w-72` : ""}>
                        <NodeTypesSidebar />
                    </div>
                </>
            )}

            <div
                className="flex-1 h-full"
                onDrop={onDrop}
                onDragOver={onDragOver}
            >
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={onNodeClick}
                    onEdgeClick={onEdgeClick}
                    onPaneClick={onPaneClick}
                    nodeTypes={nodeTypes}
                    fitView
                    deleteKeyCode="Delete"
                    multiSelectionKeyCode="Control"
                    selectionKeyCode="Shift"
                    connectionLineType={ConnectionLineType.SmoothStep}
                    connectionLineStyle={{ stroke: 'hsl(0 0% 100% / 0.6)', strokeWidth: 2 }}
                    defaultEdgeOptions={{
                        type: 'smoothstep',
                        animated: true,
                        style: { stroke: 'hsl(0 0% 100% / 0.45)', strokeWidth: 2 },
                    }}
                >
                    <Controls position="bottom-right" className="m-3" />
                    {!isMobile && (
                        <MiniMap
                            nodeStrokeWidth={2}
                            zoomable
                            pannable
                            className="!bg-card/70 !border !border-white/10 rounded-lg backdrop-blur"
                            maskColor="hsl(0 0% 4% / 0.6)"
                            nodeColor="hsl(0 0% 100% / 0.25)"
                            nodeStrokeColor="transparent"
                            nodeBorderRadius={8}
                        />
                    )}
                    <Background
                        color="hsl(0 0% 100% / 0.07)"
                        gap={20}
                        size={1}
                    />

                    {nodes.length === 0 && (
                        <Panel position="top-center" className="mt-24 pointer-events-none">
                            <motion.div
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                                className="relative flex flex-col items-center px-12 py-10 text-center"
                            >
                                {/* Radial clearing — fades the canvas dot-grid to solid near the text */}
                                <div
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-0 -z-10"
                                    style={{
                                        background:
                                            "radial-gradient(60% 60% at 50% 42%, hsl(var(--background)) 32%, transparent 78%)",
                                    }}
                                />
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.85 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
                                    className="mb-4 grid h-14 w-14 place-items-center rounded-full border border-white/15 bg-white/5 shadow-glow-sm"
                                >
                                    <Play className="h-6 w-6 text-foreground" />
                                </motion.div>
                                <h3 className="mb-1 text-xl font-semibold">
                                    <ShinyText text="Get started" />
                                </h3>
                                <p className="max-w-xs text-sm text-muted-foreground">
                                    {isMobile
                                        ? "Tap the menu and open Nodes to add workflow steps."
                                        : "Drag a trigger from the left, connect an action, then run it."}
                                </p>
                            </motion.div>
                        </Panel>
                    )}

                    {nodes.length > 0 && (
                        <Panel
                            position="top-center"
                            className="rounded-full border border-white/10 bg-card/70 px-3 py-1 text-xs text-muted-foreground shadow-md backdrop-blur md:text-sm"
                        >
                            {isMobile
                                ? "Tap a node to configure it"
                                : "Drag from a node's handle to another to connect. Drag from the sidebar to add nodes."}
                        </Panel>
                    )}

                    <Panel position="top-right" className="m-2 md:m-3 flex gap-1 md:gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSaveWorkflow}
                            aria-label="Save workflow"
                            title="Save Workflow"
                        >
                            <Save className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleLoadWorkflow}
                            aria-label="Load workflow"
                            title="Load Workflow"
                        >
                            <Download className="h-4 w-4" />
                        </Button>
                        {isWorkflowRunning ? (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleStopWorkflow}
                                aria-label="Stop workflow"
                                title="Stop Workflow"
                            >
                                <Square className="h-4 w-4" />
                            </Button>
                        ) : (
                            <Button
                                variant="default"
                                size="sm"
                                onClick={handleStartWorkflow}
                                aria-label="Start workflow"
                                title="Start Workflow"
                            >
                                <Play className="h-4 w-4" />
                            </Button>
                        )}
                    </Panel>

                    {/* On-chain record of the last run (WorkflowRegistry log_execution) */}
                    {lastExecutionLog.status !== "idle" && (
                        <Panel
                            position="bottom-center"
                            className="mb-4 px-3 py-2 bg-card rounded-lg border border-border shadow-md text-xs md:text-sm max-w-[92vw]"
                        >
                            {lastExecutionLog.status === "pending" && (
                                <span className="flex items-center gap-2 text-muted-foreground">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Recording run on-chain…
                                </span>
                            )}
                            {lastExecutionLog.status === "success" && lastExecutionLog.explorerUrl && (
                                <a
                                    href={lastExecutionLog.explorerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-primary hover:underline"
                                >
                                    <Link2 className="h-3.5 w-3.5 shrink-0" />
                                    <span>Run logged on-chain</span>
                                    {lastExecutionLog.hash && (
                                        <span className="font-mono opacity-70">
                                            {lastExecutionLog.hash.slice(0, 8)}…
                                        </span>
                                    )}
                                    <ExternalLink className="h-3 w-3 shrink-0" />
                                </a>
                            )}
                            {lastExecutionLog.status === "error" && (
                                <span className="text-muted-foreground">
                                    ⚠️ On-chain log skipped (run still succeeded)
                                </span>
                            )}
                        </Panel>
                    )}
                </ReactFlow>
            </div>

            {/* Right sidebar — overlay on mobile, inline on desktop */}
            {rightPanelVisible && (
                <>
                    {isMobile && (
                        <div
                            className="fixed inset-0 bg-black/40 z-30"
                            onClick={() => setRightPanelVisible(false)}
                        />
                    )}
                    <div className={isMobile ? `${mobilePanelBase} right-0 w-72` : ""}>
                        <PropertiesPanel />
                    </div>
                </>
            )}
        </div>
    );
}

export function WorkflowBuilder() {
    return (
        <ReactFlowProvider>
            <WorkflowCanvas />
        </ReactFlowProvider>
    );
}
