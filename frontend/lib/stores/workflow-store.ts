import { create } from "zustand";
import { nanoid } from "nanoid";
import {
  applyNodeChanges,
  applyEdgeChanges,
  Node as ReactFlowNode,
  Edge as ReactFlowEdge,
  NodeChange as ReactFlowNodeChange,
  EdgeChange as ReactFlowEdgeChange,
  XYPosition,
  Position,
} from "@reactflow/core";
import "@reactflow/core/dist/style.css";
import { toast } from "sonner";

export type NodeConfig = Record<string, string | number | boolean | string[]>;

export type NodeData = {
  label: string;
  type: string;
  icon: string;
  description: string;
  config: NodeConfig;
};

export type WorkflowNode = ReactFlowNode<NodeData>;
export type WorkflowEdge = ReactFlowEdge;

export interface NodeExecutionResult {
  success: boolean;
  [key: string]: unknown;
}

type WorkflowState = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNode: WorkflowNode | null;
  selectedEdge: WorkflowEdge | null;
  isWorkflowRunning: boolean;
  nodeExecutionState: Record<
    string,
    "pending" | "running" | "success" | "error"
  >;
  nodeResults: Record<string, NodeExecutionResult>;

  setNodes: (nodes: WorkflowNode[]) => void;
  onNodesChange: (changes: ReactFlowNodeChange[]) => void;
  addNode: (nodeType: string, position: XYPosition) => void;
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void;
  duplicateNode: (nodeId: string) => void;
  deleteNode: (nodeId: string) => void;

  setEdges: (edges: WorkflowEdge[]) => void;
  onEdgesChange: (changes: ReactFlowEdgeChange[]) => void;
  addEdge: (params: {
    source: string;
    sourceHandle: string | null;
    target: string;
    targetHandle: string | null;
  }) => void;
  deleteEdge: (edgeId: string) => void;

  setSelectedNode: (node: WorkflowNode | null) => void;
  setSelectedEdge: (edge: WorkflowEdge | null) => void;

  startWorkflow: () => Promise<void>;
  stopWorkflow: () => Promise<void>;
  executeNode: (nodeId: string, inputData?: NodeExecutionResult) => Promise<NodeExecutionResult>;

  saveWorkflow: () => void;
  loadWorkflow: () => void;
};

export const NODE_TYPES = {
  trigger: {
    category: "Triggers",
    items: [
      {
        type: "telegram-trigger",
        label: "Telegram",
        icon: "messageCircle",
        description: "Enter your Telegram chat ID and hit Run to receive auth message and start workflow",
        config: {
          chatId: "",
          messageTypes: "all",
        },
      },
      {
        type: "discord-trigger",
        label: "Discord",
        icon: "hash",
        description: "Trigger on Discord channel messages",
        config: {
          serverId: "",
          channelId: "",
          eventType: "message",
        },
      },
      {
        type: "whatsapp-trigger",
        label: "WhatsApp",
        icon: "phone",
        description: "Trigger on incoming WhatsApp messages",
        config: {
          provider: "twilio",
          phoneNumberId: "",
        },
      },
    ],
  },

  action: {
    category: "Actions",
    items: [
      {
        type: "stellar-sdk",
        label: "Stellar SDK (Chatbot)",
        icon: "send",
        description: "Chatbot mode: User asks Stellar questions in Telegram, bot answers using SDK",
        config: {
          network: "testnet",
          operation: "chatbot",
          destination: "",
        },
      },
      {
        type: "wallet-integration",
        label: "Wallet Integration",
        icon: "wallet",
        description: "Connect to Freighter browser wallet or create a Telegram-native wallet",
        config: {
          walletProvider: "freighter",
          network: "testnet",
        },
      },
      {
        type: "telegram-send",
        label: "Send Telegram",
        icon: "messageCircle",
        description: "Send a message to Telegram. Use {balance}, {address} for templates.",
        config: {
          chatId: "",
          message: "",
        },
      },
      {
        type: "anchor-onramp",
        label: "Anchor On-Ramp",
        icon: "arrowDown",
        description: "Convert fiat to Stellar assets via anchor",
        config: {
          anchorUrl: "",
          fiatCurrency: "USD",
          asset: "USDC",
          amount: "",
        },
      },
      {
        type: "anchor-offramp",
        label: "Anchor Off-Ramp",
        icon: "arrowUp",
        description: "Convert Stellar assets to fiat via anchor",
        config: {
          anchorUrl: "",
          asset: "USDC",
          fiatCurrency: "USD",
          amount: "",
        },
      },
      {
        type: "autopay",
        label: "AutoPay",
        icon: "repeat",
        description: "Set up recurring XLM payments at regular intervals from your Telegram wallet",
        config: {
          destinationAddress: "",
          amount: "",
          interval: "3600s",
          totalDuration: "24h",
        },
      },
      {
        type: "multisig",
        label: "Multisig Approval",
        icon: "shield",
        description: "Require multiple wallet signers to approve a transaction before execution",
        config: {
          signerAddresses: "",
          approvalTimeout: "300s",
          autoExecute: "false",
        },
      },
    ],
  },

  logic: {
    category: "Logic",
    items: [
      {
        type: "delay",
        label: "Delay",
        icon: "clock",
        description: "Add a delay in workflow execution",
        config: { delay: 5 },
      },
      {
        type: "autopay",
        label: "AutoPay",
        icon: "repeat",
        description: "Set up recurring scheduled payments",
        config: {
          destination: "",
          amount: "",
          interval: "daily",
          duration: 30,
        },
      },
      {
        type: "multisig",
        label: "Multisig",
        icon: "users",
        description: "Require multiple approvals before execution",
        config: {
          threshold: 2,
          signers: [],
          timeout: 24,
        },
      },
    ],
  },
};

/** Safely extract a string value from a NodeConfig field */
function configStr(config: NodeConfig, key: string): string {
  const val = config[key];
  return typeof val === "string" ? val : val != null ? String(val) : "";
}

/** Safely extract a string from an execution result field */
function resultStr(result: NodeExecutionResult | undefined, key: string): string {
  if (!result) return "";
  const val = result[key];
  return typeof val === "string" ? val : val != null ? String(val) : "";
}

export const getNodeDataFromType = (nodeType: string): NodeData | null => {
  for (const category of Object.values(NODE_TYPES)) {
    const item = category.items.find((item) => item.type === nodeType);
    if (item) {
      return {
        label: item.label,
        type: item.type,
        icon: item.icon,
        description: item.description,
        config: Object.fromEntries(
          Object.entries(item.config).filter(([, v]) => v !== undefined)
        ) as NodeConfig,
      };
    }
  }
  return null;
};

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNode: null,
  selectedEdge: null,
  isWorkflowRunning: false,
  nodeExecutionState: {},
  nodeResults: {},

  setNodes: (nodes) => set({ nodes }),
  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },

  addNode: (nodeType, position) => {
    const nodeData = getNodeDataFromType(nodeType);
    if (!nodeData) return;

    const newNode: WorkflowNode = {
      id: nanoid(),
      type: "customNode",
      position,
      data: nodeData,
    };

    set((state) => ({
      nodes: [...state.nodes, newNode],
      selectedNode: newNode,
    }));
  },

  updateNodeData: (nodeId, data) => {
    set((state) => {
      const node = state.nodes.find((n) => n.id === nodeId);
      if (!node) return state;

      let updatedData = { ...data };
      if (data.config) {
        updatedData.config = {
          ...node.data.config,
          ...data.config,
        };
      }

      const updatedNodes = state.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, ...updatedData } }
          : n
      );

      return {
        nodes: updatedNodes,
        selectedNode:
          state.selectedNode?.id === nodeId
            ? updatedNodes.find((n) => n.id === nodeId) || state.selectedNode
            : state.selectedNode,
      };
    });
  },

  duplicateNode: (nodeId) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const newNode: WorkflowNode = {
      ...node,
      id: nanoid(),
      position: {
        x: node.position.x + 50,
        y: node.position.y + 50,
      },
    };

    set((state) => ({
      nodes: [...state.nodes, newNode],
      selectedNode: newNode,
    }));
  },

  deleteNode: (nodeId) => {
    set((state) => {
      const newEdges = state.edges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId
      );
      return {
        nodes: state.nodes.filter((node) => node.id !== nodeId),
        edges: newEdges,
        selectedNode:
          state.selectedNode?.id === nodeId ? null : state.selectedNode,
      };
    });
  },

  setEdges: (edges) => set({ edges }),
  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },

  addEdge: (params) => {
    const exists = get().edges.some(
      (edge) =>
        edge.source === params.source &&
        edge.target === params.target &&
        edge.sourceHandle === params.sourceHandle &&
        edge.targetHandle === params.targetHandle
    );
    if (exists) return;

    const newEdge: WorkflowEdge = {
      id: nanoid(),
      ...params,
      type: "smoothstep",
      animated: true,
    };

    set((state) => ({
      edges: [...state.edges, newEdge],
    }));
  },

  deleteEdge: (edgeId) => {
    set((state) => ({
      edges: state.edges.filter((edge) => edge.id !== edgeId),
      selectedEdge:
        state.selectedEdge?.id === edgeId ? null : state.selectedEdge,
    }));
  },

  setSelectedNode: (node) => set({ selectedNode: node }),
  setSelectedEdge: (edge) => set({ selectedEdge: edge }),

  startWorkflow: async () => {
    try {
      set({
        isWorkflowRunning: true,
        nodeExecutionState: {},
        nodeResults: {},
      });

      const { nodes, edges } = get();
      const triggerNodes = nodes.filter(
        (node) => !edges.some((edge) => edge.target === node.id)
      );

      for (const triggerNode of triggerNodes) {
        get().executeNode(triggerNode.id);
      }
    } catch (error) {
      console.error("Error starting workflow:", error);
      const msg = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Workflow failed: ${msg}`);
      set({ isWorkflowRunning: false });
    }
  },

  stopWorkflow: async () => {
    toast.info("Workflow stopped");
    set({
      isWorkflowRunning: false,
      nodeExecutionState: {},
      nodeResults: {},
    });
  },

  executeNode: async (nodeId, inputData) => {
    try {
      const { nodes, edges } = get();
      const node = nodes.find((n) => n.id === nodeId);

      if (!node) {
        throw new Error(`Node with id ${nodeId} not found`);
      }

      set((state) => ({
        nodeExecutionState: {
          ...state.nodeExecutionState,
          [nodeId]: "running",
        },
      }));

      let result: NodeExecutionResult = { success: false };
      const { nodeExecutors } = await import("@/lib/utils/api-service");

      switch (node.data.type) {
        case "telegram-trigger": {
          // Find all nodes connected to this telegram trigger
          const connectedNodeIds = edges
            .filter((e) => e.source === nodeId)
            .map((e) => e.target);
          const connectedNodes = nodes.filter((n) => connectedNodeIds.includes(n.id));
          const connectedNodeTypes = connectedNodes.map((n) => n.data.type);

          const connectResult = await nodeExecutors.executeTelegramConnect(
            node.data.config,
            connectedNodeTypes
          );

          set((state) => ({
            nodeResults: { ...state.nodeResults, [nodeId]: connectResult },
            nodeExecutionState: {
              ...state.nodeExecutionState,
              [nodeId]: "success",
            },
          }));

          const chatId = configStr(node.data.config, "chatId") || resultStr(connectResult, "chatId");
          const payload: NodeExecutionResult = { ...connectResult, chatId };

          // Only execute connected nodes if there are any
          if (connectedNodeIds.length > 0) {
            for (const edge of edges.filter((e) => e.source === nodeId)) {
              await get().executeNode(edge.target, payload);
            }
          }

          result = payload;
          break;
        }

        case "stellar-sdk": {
          const stellarResult = await nodeExecutors.executeStellarSDK(
            node.data.config,
            { ...inputData, chatId: resultStr(inputData, "chatId") }
          );

          set((state) => ({
            nodeResults: { ...state.nodeResults, [nodeId]: stellarResult },
            nodeExecutionState: {
              ...state.nodeExecutionState,
              [nodeId]: "success",
            },
          }));

          const payload = {
            ...stellarResult,
            chatId: resultStr(inputData, "chatId"),
            mode: "chatbot",
          };

          for (const edge of edges.filter((e) => e.source === nodeId)) {
            await get().executeNode(edge.target, payload);
          }

          result = payload;
          break;
        }

        case "wallet-integration": {
          const walletResult = await nodeExecutors.executeWalletIntegration(
            node.data.config,
            inputData
          );

          set((state) => ({
            nodeResults: { ...state.nodeResults, [nodeId]: walletResult },
            nodeExecutionState: {
              ...state.nodeExecutionState,
              [nodeId]: "success",
            },
          }));

          for (const edge of edges.filter((e) => e.source === nodeId)) {
            await get().executeNode(edge.target, { ...inputData, ...walletResult });
          }

          result = walletResult;
          break;
        }

        case "telegram-send": {
          const sendConfig = {
            ...node.data.config,
            chatId: configStr(node.data.config, "chatId") || resultStr(inputData, "chatId"),
          };

          const sendResult = await nodeExecutors.executeTelegramSend(
            sendConfig,
            inputData
          );

          set((state) => ({
            nodeResults: { ...state.nodeResults, [nodeId]: sendResult },
            nodeExecutionState: {
              ...state.nodeExecutionState,
              [nodeId]: "success",
            },
          }));

          for (const edge of edges.filter((e) => e.source === nodeId)) {
            await get().executeNode(edge.target, { ...inputData, ...sendResult });
          }

          result = sendResult;
          break;
        }

        case "autopay": {
          const autopayResult = await nodeExecutors.executeAutoPay(
            node.data.config,
            { ...inputData, chatId: resultStr(inputData, "chatId") }
          );

          set((state) => ({
            nodeResults: { ...state.nodeResults, [nodeId]: autopayResult },
            nodeExecutionState: {
              ...state.nodeExecutionState,
              [nodeId]: "success",
            },
          }));

          const payload = { ...autopayResult, ...inputData };

          for (const edge of edges.filter((e) => e.source === nodeId)) {
            await get().executeNode(edge.target, payload);
          }

          result = payload;
          break;
        }

        case "multisig": {
          const multisigResult = await nodeExecutors.executeMultisig(
            node.data.config,
            { ...inputData, chatId: resultStr(inputData, "chatId") }
          );

          set((state) => ({
            nodeResults: { ...state.nodeResults, [nodeId]: multisigResult },
            nodeExecutionState: {
              ...state.nodeExecutionState,
              [nodeId]: "success",
            },
          }));

          const payload = { ...multisigResult, ...inputData };

          for (const edge of edges.filter((e) => e.source === nodeId)) {
            await get().executeNode(edge.target, payload);
          }

          result = payload;
          break;
        }

        case "delay": {
          const delay = parseInt(configStr(node.data.config, "delay") || "5", 10) * 1000;
          await new Promise((r) => setTimeout(r, delay));
          set((state) => ({
            nodeExecutionState: {
              ...state.nodeExecutionState,
              [nodeId]: "success",
            },
          }));
          result = { success: true, delayed: delay };
          for (const edge of edges.filter((e) => e.source === nodeId)) {
            await get().executeNode(edge.target, { success: true, ...inputData, delayed: delay });
          }
          break;
        }

        case "anchor-onramp": {
          const onrampResult = await nodeExecutors.executeAnchorOnRamp(
            node.data.config,
            inputData
          );

          set((state) => ({
            nodeResults: { ...state.nodeResults, [nodeId]: onrampResult },
            nodeExecutionState: {
              ...state.nodeExecutionState,
              [nodeId]: "success",
            },
          }));

          for (const edge of edges.filter((e) => e.source === nodeId)) {
            await get().executeNode(edge.target, { ...inputData, ...onrampResult });
          }

          result = onrampResult;
          break;
        }

        case "anchor-offramp": {
          const offrampResult = await nodeExecutors.executeAnchorOffRamp(
            node.data.config,
            inputData
          );

          set((state) => ({
            nodeResults: { ...state.nodeResults, [nodeId]: offrampResult },
            nodeExecutionState: {
              ...state.nodeExecutionState,
              [nodeId]: "success",
            },
          }));

          for (const edge of edges.filter((e) => e.source === nodeId)) {
            await get().executeNode(edge.target, { ...inputData, ...offrampResult });
          }

          result = offrampResult;
          break;
        }


        default: {
          if (
            ["discord-trigger", "whatsapp-trigger"].includes(
              node.data.type
            )
          ) {
            set((state) => ({
              nodeExecutionState: {
                ...state.nodeExecutionState,
                [nodeId]: "error",
              },
            }));
            throw new Error(`Node type "${node.data.type}" not yet implemented`);
          }
          throw new Error(`Unknown node type: ${node.data.type}`);
        }
      }

      return result;
    } catch (error) {
      console.error(`Error executing node ${nodeId}:`, error);
      const msg = error instanceof Error ? error.message : "Unknown error";
      const node = get().nodes.find((n) => n.id === nodeId);
      toast.error(`${node?.data.label || "Node"} failed: ${msg}`);
      set((state) => ({
        nodeExecutionState: {
          ...state.nodeExecutionState,
          [nodeId]: "error",
        },
      }));
      throw error;
    }
  },

  saveWorkflow: () => {
    const { nodes, edges } = get();
    localStorage.setItem('stellrflow_workflow', JSON.stringify({ nodes, edges }));
  },
  loadWorkflow: () => {
    const saved = localStorage.getItem('stellrflow_workflow');
    if (saved) {
      const { nodes, edges } = JSON.parse(saved);
      set({ nodes, edges });
    }
  },
}));
