import dagre from "@dagrejs/dagre";

const NODE_W = 240;
const NODE_H = 90;

// color per reverse_engineering_type
export const TYPE_COLORS = {
  "Question Node": "#fff2cc",
  "Yes Node": "#9dbb61",
  "No Node": "#c05046",
  "status node": "#b7dde8",
  "condition": "#e5b9b5",
  "obligation": "#e5b9b5",
  "Obligations Node": "#d9a7a1",
  "if condition": "#ddd6e5",
  "IF collector node": "#ab9ac0",
  "Explanatory Node": "#f2f2f2",
  "control": "#fcebdd",
  "Elements of control/obligation": "#ffffff",
  "Intermediate Conclusion": "#ffffff",
  unknown: "#eeeaf2",
};

// Branch-marker types that must sit on the same rank as their siblings rather
// than being pushed down a level by sideways connector edges.
const SIBLING_TYPES = new Set(["Yes Node", "No Node", "if condition"]);

// A connector *between* two sibling branch nodes - the "OR"/"AND" chain linking
// if-conditions, or a Yes<->No link. These only serialize siblings into a
// staircase; excluding them from the layout graph lets every sibling take its
// rank from the shared parent edge instead, so they line up at one height.
// They are still drawn (rfEdges keeps the full edge list).
function isSiblingConnector(e, typeOf) {
  return SIBLING_TYPES.has(typeOf(e.from)) && SIBLING_TYPES.has(typeOf(e.to));
}

// Y within half a node box counts as "same row".
const ROW_EPS = NODE_H / 2;

export function buildGraph(data) {
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: "TB", nodesep: 35, ranksep: 70, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));

  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  const present = new Set(data.nodes.map((n) => n.id));
  const typeOf = (id) => byId.get(id)?.reverse_engineering_type;

  for (const n of data.nodes) g.setNode(n.id, { width: NODE_W, height: NODE_H });
  const edges = data.edges.filter((e) => present.has(e.from) && present.has(e.to));
  for (const e of edges) {
    if (isSiblingConnector(e, typeOf)) continue;
    // Pull branch children hard toward their parent's rank so cross-links
    // elsewhere in the graph can't sink one sibling a level below the others.
    const opts = SIBLING_TYPES.has(typeOf(e.to)) ? { weight: 8 } : {};
    g.setEdge(e.from, e.to, opts, e.id);
  }

  dagre.layout(g);

  const pos = new Map(data.nodes.map((n) => [n.id, { ...g.node(n.id) }]));

  // Residual clean-up: any sibling branch group dagre still left split is
  // snapped to its majority row - but only for members whose target slot is
  // clear, so this can never introduce an overlap.
  for (const n of data.nodes) {
    const siblings = edges
      .filter((e) => e.from === n.id && SIBLING_TYPES.has(typeOf(e.to)))
      .map((e) => e.to);
    if (siblings.length < 2) continue;

    const rowY = majority(siblings.map((id) => pos.get(id).y));
    for (const id of siblings) {
      const p = pos.get(id);
      if (Math.abs(p.y - rowY) <= ROW_EPS) continue;
      if (rowIsClear(id, p.x, rowY, pos)) p.y = rowY;
    }
  }

  const nodes = data.nodes.map((n) => {
    const p = pos.get(n.id);
    const bg = TYPE_COLORS[n.reverse_engineering_type] ?? "#eeeaf2";
    return {
      id: n.id,
      position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 },
      data: {
        label: (
          <div>
            <div style={{ fontWeight: 600, fontSize: 11, opacity: 0.65 }}>
              {n.reverse_engineering_type}
            </div>
            <div style={{ fontSize: 12 }}>{(n.label || "").trim()}</div>
          </div>
        ),
      },
      style: {
        width: NODE_W,
        background: bg,
        border: "1px solid rgba(0,0,0,0.25)",
        borderRadius: 8,
        padding: 8,
        fontSize: 12,
      },
    };
  });

  const rfEdges = edges.map(makeEdge);
  return { nodes, edges: rfEdges };
}

// Most common value among near-equal numbers (buckets within ROW_EPS).
function majority(values) {
  const buckets = [];
  for (const v of values) {
    const b = buckets.find((x) => Math.abs(x.y - v) <= ROW_EPS);
    if (b) b.count++;
    else buckets.push({ y: v, count: 1 });
  }
  buckets.sort((a, b) => b.count - a.count);
  return buckets[0].y;
}

// Would moving node `id` to (x, y) collide with any other node?
function rowIsClear(id, x, y, pos) {
  for (const [other, p] of pos) {
    if (other === id) continue;
    if (Math.abs(p.x - x) < NODE_W + 15 && Math.abs(p.y - y) < NODE_H + 10) return false;
  }
  return true;
}

function makeEdge(e) {
  return {
    id: e.id,
    source: e.from,
    target: e.to,
    label: (e.label || "").trim() || undefined,
    labelStyle: { fontSize: 10 },
    labelBgStyle: { fill: "#fff" },
    markerEnd: { type: "arrowclosed" },
  };
}
