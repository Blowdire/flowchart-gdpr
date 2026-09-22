import { norm } from "../graphIndex.js";
import { detectIfGroup } from "./ifGroup.js";

// The plain-fork pattern:
//
//   Question ─▶ if condition ──(OR)──▶ if condition ...   with NO IF collector
//                    │                      │
//                    ▼                      ▼
//                 branch A               branch B
//
// The conditions are mutually exclusive branches: the user picks exactly one
// and the flow continues down that condition's own successor. (Contrast with
// patterns/ifGroup.js, where the conditions feed a collector that produces a
// single Yes/No.)

const CONNECTIVES = new Set(["OR", "AND"]);

export function detectBranchGroup(questionNode, g) {
  if (detectIfGroup(questionNode, g)) return null; // collector variant, not a fork

  const children = g.out(questionNode.id).map((e) => g.node(e.to)).filter(Boolean);
  if (children.length < 2) return null;
  if (!children.every((c) => c.reverse_engineering_type === "if condition")) return null;

  // The connective may be written either on a child->child edge (476) or on the
  // question->child edge (562). Require it somewhere, else this is an unrelated
  // fan-out rather than a labelled fork.
  const ids = new Set(children.map((c) => c.id));
  const connectors = [];
  for (const e of g.out(questionNode.id)) {
    if (ids.has(e.to)) connectors.push(norm(e.label).toUpperCase());
  }
  for (const c of children) {
    for (const e of g.out(c.id)) {
      if (ids.has(e.to)) connectors.push(norm(e.label).toUpperCase());
    }
  }
  const known = [...new Set(connectors)].filter((l) => CONNECTIVES.has(l));
  if (known.length === 0) return null;
  return {
    connective: known.length === 1 ? known[0] : "OR",
    options: children.map((c) => ({ id: c.id, label: norm(c.label) })),
  };
}
