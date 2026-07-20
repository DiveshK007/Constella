// nanoid ships ESM-only; mock it so the store module transforms cleanly and
// node ids are deterministic within a test.
jest.mock("nanoid", () => {
  let c = 0;
  return { nanoid: () => `id-${++c}` };
});

import { useWorkflowStore } from "@/lib/stores/workflow-store";

const store = useWorkflowStore;

function resetStore() {
  store.setState({
    nodes: [],
    edges: [],
    selectedNode: null,
    selectedEdge: null,
    nodeExecutionState: {},
    nodeResults: {},
    lastExecutionLog: { status: "idle" },
  });
}

describe("workflow store", () => {
  beforeEach(() => {
    resetStore();
    localStorage.clear();
  });

  it("adds a node from a valid node type", () => {
    store.getState().addNode("telegram-trigger", { x: 10, y: 20 });
    const { nodes } = store.getState();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].data.type).toBe("telegram-trigger");
    expect(nodes[0].position).toEqual({ x: 10, y: 20 });
  });

  it("ignores an unknown node type", () => {
    store.getState().addNode("does-not-exist", { x: 0, y: 0 });
    expect(store.getState().nodes).toHaveLength(0);
  });

  it("connects two nodes with an edge and dedupes duplicate connections", () => {
    store.getState().addNode("telegram-trigger", { x: 0, y: 0 });
    store.getState().addNode("telegram-send", { x: 100, y: 0 });
    const [a, b] = store.getState().nodes;
    const params = { source: a.id, sourceHandle: null, target: b.id, targetHandle: null };

    store.getState().addEdge(params);
    store.getState().addEdge(params); // identical connection -> ignored

    const { edges } = store.getState();
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe(a.id);
    expect(edges[0].target).toBe(b.id);
  });

  it("deletes a node along with its connected edges", () => {
    store.getState().addNode("telegram-trigger", { x: 0, y: 0 });
    store.getState().addNode("telegram-send", { x: 100, y: 0 });
    const [a, b] = store.getState().nodes;
    store.getState().addEdge({ source: a.id, sourceHandle: null, target: b.id, targetHandle: null });

    store.getState().deleteNode(a.id);

    expect(store.getState().nodes).toHaveLength(1);
    expect(store.getState().nodes[0].id).toBe(b.id);
    expect(store.getState().edges).toHaveLength(0);
  });

  it("saves a workflow and loads it back from localStorage", () => {
    store.getState().addNode("telegram-trigger", { x: 5, y: 5 });
    store.getState().saveWorkflow();
    expect(localStorage.getItem("stellrflow_workflow")).not.toBeNull();

    resetStore();
    expect(store.getState().nodes).toHaveLength(0);

    store.getState().loadWorkflow();
    const { nodes } = store.getState();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].data.type).toBe("telegram-trigger");
  });

  it("updates a node's config data", () => {
    store.getState().addNode("telegram-trigger", { x: 0, y: 0 });
    const id = store.getState().nodes[0].id;

    store.getState().updateNodeData(id, { config: { chatId: "12345" } });

    expect(store.getState().nodes[0].data.config.chatId).toBe("12345");
  });
});
