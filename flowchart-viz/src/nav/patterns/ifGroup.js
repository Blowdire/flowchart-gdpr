import { norm } from "../graphIndex.js";

// The "if-condition group" pattern:
//
//   Question ─▶ if condition ──(OR)──▶ if condition ──(OR)──▶ ...   (a chain)
//                   │                      │
//                   └──────▶ IF collector node ◀──────┘
//                                   │
//                               Yes / No
//
// The conditions are joined by a connective (OR today, AND left as a hook).
// The collector resolves to its Yes branch when the connective is satisfied by
// the user's selection, otherwise the No branch.
//
// Everything about this shape lives in this file; resolvers.js only asks
// "does this question start a group?" and the engine only asks "given these
// selections, where do we go and what do we mark visited?".

const CONNECTIVES = new Set(["OR", "AND"]);

export function detectIfGroup(questionNode, g) {
  const children = g.out(questionNode.id).map((e) => g.node(e.to)).filter(Boolean);
  if (children.length < 2) return null;
  if (!children.every((c) => c.reverse_engineering_type === "if condition")) return null;

  const collectorId = sharedCollector(children, g);
  if (!collectorId) return null;

  const collectorOut = g.out(collectorId).map((e) => g.node(e.to)).filter(Boolean);
  const yes = collectorOut.find((n) => n.reverse_engineering_type === "Yes Node");
  const no = collectorOut.find((n) => n.reverse_engineering_type === "No Node");
  if (!yes || !no) return null;

  return {
    connective: connectiveOf(children, g),
    conditions: children.map((c) => ({ id: c.id, label: norm(c.label) })),
    collectorId,
    yesId: yes.id,
    noId: no.id,
  };
}

// Where the group sends the navigator once the user submits `selectedIds`.
export function evaluateGroup(group, selectedIds) {
  const some = group.conditions.some((c) => selectedIds.has(c.id));
  const every = group.conditions.every((c) => selectedIds.has(c.id));
  const satisfied = group.connective === "AND" ? every : some;
  return satisfied ? group.yesId : group.noId;
}

// For rewind: the Question Node that owns a group-internal node, if any.
export function findGroupQuestion(nodeId, g, seen = new Set()) {
  if (seen.has(nodeId)) return null;
  seen.add(nodeId);

  const node = g.node(nodeId);
  const type = node?.reverse_engineering_type;
  if (type !== "if condition" && type !== "IF collector node") return null;

  for (const e of g.in(nodeId)) {
    const src = g.node(e.from);
    // Any question that fans out into if-conditions owns them - collector
    // variant (ifGroup) or plain fork (branchGroup) alike.
    if (src?.reverse_engineering_type === "Question Node") {
      const kids = g.out(src.id).map((c) => g.node(c.to));
      if (kids.length >= 2 && kids.every((k) => k?.reverse_engineering_type === "if condition")) {
        return src.id;
      }
    }
    if (src?.reverse_engineering_type === "if condition") {
      const owner = findGroupQuestion(src.id, g, seen);
      if (owner) return owner;
    }
  }
  return null;
}

// All conditions that point at a collector must point at the *same* one.
// Conditions with no collector edge are tolerated (the source data isn't always
// complete) as long as at least one condition anchors the group.
function sharedCollector(conditions, g) {
  const collectors = new Set();
  for (const c of conditions) {
    for (const e of g.out(c.id)) {
      if (g.node(e.to)?.reverse_engineering_type === "IF collector node") collectors.add(e.to);
    }
  }
  return collectors.size === 1 ? [...collectors][0] : null;
}

function connectiveOf(conditions, g) {
  const ids = new Set(conditions.map((c) => c.id));
  const labels = new Set();
  for (const c of conditions) {
    for (const e of g.out(c.id)) {
      if (ids.has(e.to)) labels.add(norm(e.label).toUpperCase());
    }
  }
  const known = [...labels].filter((l) => CONNECTIVES.has(l));
  return known.length === 1 ? known[0] : "OR"; // mixed / unlabelled -> default OR
}
