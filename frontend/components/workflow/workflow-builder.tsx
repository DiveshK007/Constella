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
import { Play, Square, Save, Download } from "lucide-react";
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
    } = useWorkflowStore();

    const reactFlowInstance = useReactFlow();
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const isMobile = useIsMobile();

    // Default panels hidden on mobile, visible on desktop
    const [leftPanelVisible, setLeftPanelVisible] = useState(true);
    const [rightPanelVisible, setRightPanelVisible] = useState(true);

    // Auto-collapse panels on mobile
    useEffect(() => {
        if (isMobile) {
            setLeftPanelVisible(false);
            setRightPanelVisible(false);
        } else {
            setLeftPanelVisible(true);
            setRightPanelVisible(true);
        }
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
                    connectionLineStyle={{ stroke: 'hsl(266, 85%, 77%)', strokeWidth: 2 }}
                    defaultEdgeOptions={{
                        type: 'smoothstep',
                        animated: true,
                        style: { stroke: 'hsl(266, 85%, 77%)', strokeWidth: 2 },
                    }}
                >
                    <Controls position="bottom-right" className="m-3" />
                    {!isMobile && (
                        <MiniMap
                            nodeStrokeWidth={3}
                            zoomable
                            pannable
                            className="bg-card border border-border rounded-md"
                            nodeBorderRadius={8}
                        />
                    )}
                    <Background
                        color="hsl(var(--muted-foreground))"
                        gap={16}
                        size={1}
                    />

                    {nodes.length === 0 && (
                        <Panel
                            position="top-center"
                            className="mt-16 p-6 bg-card rounded-xl border border-border shadow-lg text-center max-w-xs"
                        >
                            <div className="mx-auto rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-3">
                                <Play className="h-5 w-5 text-primary" />
                            </div>
                            <h3 className="font-semibold text-base mb-1">Get started</h3>
                            <p className="text-sm text-muted-foreground">
                                {isMobile
                                    ? "Tap the menu and open Nodes to add workflow steps."
                                    : "Drag nodes from the left sidebar to build your workflow."}
                            </p>
                        </Panel>
                    )}

                    {nodes.length > 0 && (
                        <Panel
                            position="top-center"
                            className="p-1 px-2 bg-card rounded-md border border-border text-xs md:text-sm shadow-md"
                        >
                            {isMobile
                                ? "Tap a node to configure it"
                                : "Click nodes to connect them. Drag from sidebar to add new nodes."}
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
