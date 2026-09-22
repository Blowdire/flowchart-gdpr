// Indexed view over the raw flowchart JSON: O(1) node lookup and edge adjacency.
export function buildIndex(data) {
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  const outEdges = new Map();
  const inEdges = new Map();
  for (const n of data.nodes) {
    outEdges.set(n.id, []);
    inEdges.set(n.id, []);
  }
  for (const e of data.edges) {
    if (!byId.has(e.from) || !byId.has(e.to)) continue;
    outEdges.get(e.from).push(e);
    inEdges.get(e.to).push(e);
  }
  return {
    data,
    start: data.start,
    node: (id) => byId.get(id) ?? null,
    out: (id) => outEdges.get(id) ?? [],
    in: (id) => inEdges.get(id) ?? [],
  };
}

export const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
