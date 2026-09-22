import { useEffect, useMemo, useRef } from "react";
import { ReactFlow, Background, Controls, MiniMap } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { buildGraph } from "./layout.jsx";
import data from "./flowchart.json";
import { useNavigator } from "./nav/useNavigator.js";
import NavPanel from "./nav/NavPanel.jsx";

export default function App() {
  const base = useMemo(() => buildGraph(data), []);
  const nav = useNavigator(data);
  const rf = useRef(null);

  const visited = useMemo(() => new Set(nav.visited), [nav.visited]);
  const frontier = useMemo(() => new Set(nav.frontier.map((f) => f.id)), [nav.frontier]);
  const traversed = useMemo(() => {
    const s = new Set();
    for (let i = 0; i < nav.visited.length - 1; i++) {
      s.add(`${nav.visited[i]}->${nav.visited[i + 1]}`);
    }
    return s;
  }, [nav.visited]);

  const nodes = useMemo(
    () =>
      base.nodes.map((n) => {
        const isActive = frontier.has(n.id);
        const isVisited = visited.has(n.id);
        return {
          ...n,
          style: {
            ...n.style,
            opacity: isVisited || isActive ? 1 : 0.35,
            border: isActive
              ? "3px solid #2563eb"
              : isVisited
                ? "2px solid #16a34a"
                : n.style.border,
            boxShadow: isActive ? "0 0 0 5px rgba(37,99,235,0.25)" : undefined,
          },
        };
      }),
    [base.nodes, visited, frontier],
  );

  const edges = useMemo(
    () =>
      base.edges.map((e) => {
        const on = traversed.has(`${e.source}->${e.target}`) || (visited.has(e.source) && visited.has(e.target));
        return {
          ...e,
          animated: traversed.has(`${e.source}->${e.target}`),
          style: {
            ...e.style,
            stroke: on ? "#16a34a" : "#b1b1b7",
            strokeWidth: on ? 2.5 : 1,
            opacity: on ? 1 : 0.4,
          },
        };
      }),
    [base.edges, traversed, visited],
  );

  // Keep the active frontier in view as navigation progresses.
  useEffect(() => {
    const inst = rf.current;
    if (!inst || nav.frontier.length === 0) return;
    inst.fitView({
      nodes: nav.frontier.map((f) => ({ id: f.id })),
      duration: 600,
      maxZoom: 1,
      padding: 0.35,
    });
  }, [nav.frontier]);

  return (
    <div style={{ width: "100vw", height: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onInit={(i) => {
          rf.current = i;
        }}
        fitView
        minZoom={0.05}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
      <NavPanel nav={nav} />
    </div>
  );
}
