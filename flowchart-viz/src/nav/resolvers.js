import { norm } from "./graphIndex.js";
import { detectIfGroup } from "./patterns/ifGroup.js";
import { detectBranchGroup } from "./patterns/branchGroup.js";

// A "step" tells the navigator what happens when it arrives AT a node.
//
//   { kind: "choice",   prompt, options: [{ key, label, to }], unhandled? }
//       -> wait for the user to pick one option; `to` is the next node id.
//   { kind: "multi",    prompt, connective, options: [{ key, label }], group }
//       -> wait for the user to select any number of options, then submit;
//          the engine routes via `group` (see patterns/ifGroup.js).
//   { kind: "auto",     to }
//       -> pass straight through; the engine advances automatically and marks
//          this node visited (used for Yes/No branch markers).
//   { kind: "fork",     prompt, reason?, branches: [{ key, label, to }] }
//       -> stop and show a "Next" button; on Next EVERY branch becomes a live
//          frontier entry in parallel (an Obligations Node fanning out).
//   { kind: "terminal", reason?, continuations?: [{ key, label, to }] }
//       -> stop here. `continuations` are non-semantic "keep going" links for
//          node types we don't interpret yet.
//
// Adding a new scenario = adding a resolver keyed by reverse_engineering_type
// (and, for a multi-node shape, a small module under patterns/).

function option(key, label, to) {
  return { key, label, to };
}

const typeOf = (g, id) => g.node(id)?.reverse_engineering_type;

// Question Node: today it branches into a "Yes Node" and a "No Node".
// Tomorrow it may instead feed an "IF collector node" or fan out into several
// "if condition" nodes acting as branches - handled by returning a generic
// choice over the children until dedicated resolvers exist.
function questionStep(node, g) {
  // Shape 1: N "if condition" children joined by OR/AND, collected by an
  // "IF collector node" that branches Yes/No.
  const group = detectIfGroup(node, g);
  if (group) {
    return {
      kind: "multi",
      prompt: norm(node.label),
      connective: group.connective,
      options: group.conditions.map((c) => option(c.id, c.label, c.id)),
      group,
    };
  }

  // Shape 2: N "if condition" children joined by OR/AND with NO collector -
  // a plain fork; the user picks one branch and continues down it.
  const branch = detectBranchGroup(node, g);
  if (branch) {
    return {
      kind: "choice",
      prompt: norm(node.label),
      options: branch.options.map((o) => ({
        key: o.id,
        label: o.label,
        to: o.id,
        answerLabel: o.label,
      })),
    };
  }

  const kids = g.out(node.id).map((e) => ({ edge: e, node: g.node(e.to) }));

  const isYes = (k) => k.node?.reverse_engineering_type === "Yes Node";
  const isNo = (k) => k.node?.reverse_engineering_type === "No Node";
  const yes = kids.find(isYes);
  const no = kids.find(isNo);

  if (yes || no) {
    const options = [];
    if (yes) options.push(option("yes", "Yes", yes.node.id));
    if (no) options.push(option("no", "No", no.node.id));
    return { kind: "choice", prompt: norm(node.label), options };
  }

  // Not a yes/no question yet - e.g. N "if condition" children, or an
  // "IF collector node" downstream. Expose the raw branches so navigation
  // still works; a dedicated resolver will refine this later.
  const branchable = kids.filter((k) => k.node);
  if (branchable.length > 0) {
    return {
      kind: "choice",
      prompt: norm(node.label),
      unhandled: true,
      options: branchable.map((k, i) =>
        option(
          k.node.id,
          norm(k.edge.label) || norm(k.node.label) || `Branch ${i + 1}`,
          k.node.id,
        ),
      ),
    };
  }

  return { kind: "terminal", reason: "question has no outgoing branches" };
}

// Yes / No nodes are pure branch markers: walk through to whatever follows.
function passThrough(node, g) {
  const outs = g.out(node.id);
  if (outs.length === 1) return { kind: "auto", to: outs[0].to };
  if (outs.length === 0) return { kind: "terminal", reason: "end of branch" };
  // Rare: a Yes/No node with several successors - let the user pick.
  return {
    kind: "choice",
    prompt: norm(node.label) || "Continue to",
    options: outs.map((e, i) =>
      option(e.to, norm(e.label) || norm(g.node(e.to)?.label) || `Path ${i + 1}`, e.to),
    ),
  };
}

// Status node: a conclusion/state the path has reached ("GDPR does not apply",
// "Data cannot be processed", ...). Most are terminal; some continue. We don't
// prompt here - just flow through. Collected statuses are read off the visited
// path (see collectStatuses) and shown in the panel.
function statusStep(node, g) {
  const outs = g.out(node.id);
  if (outs.length === 1) return { kind: "auto", to: outs[0].to };
  if (outs.length === 0) return { kind: "terminal", reason: "status reached" };
  return {
    kind: "choice",
    prompt: norm(node.label) || "Continue to",
    options: outs.map((e, i) =>
      option(e.to, norm(e.label) || norm(g.node(e.to)?.label) || `Path ${i + 1}`, e.to),
    ),
  };
}

// Fallbacks for landing directly on a group-internal node (e.g. via rewind).
// The primary path never hits these - it goes Question -> multi -> outcome.
function ifConditionStep(node, g) {
  const collector = g
    .out(node.id)
    .map((e) => g.node(e.to))
    .find((n) => n?.reverse_engineering_type === "IF collector node");
  return collector ? { kind: "auto", to: collector.id } : passThrough(node, g);
}

function ifCollectorStep(node, g) {
  const outs = g.out(node.id).map((e) => g.node(e.to)).filter(Boolean);
  const yes = outs.find((n) => n.reverse_engineering_type === "Yes Node");
  const no = outs.find((n) => n.reverse_engineering_type === "No Node");
  if (yes || no) {
    const options = [];
    if (yes) options.push(option("yes", "Yes", yes.id));
    if (no) options.push(option("no", "No", no.id));
    return { kind: "choice", prompt: norm(node.label) || "Does any condition apply?", options };
  }
  return passThrough(node, g);
}

// Obligation / Obligations Node: a duty (or heading of duties) the path has
// landed on. `control` bullets are detail; nested obligations/headings are just
// more duties (collected, not navigated) - but the flowchart often *continues*
// past them. Flatten through the whole obligation subtree to the real
// downstream nodes and offer them as parallel branches behind a "Next" button.
function obligationContinuations(nodeId, g, seen = new Set()) {
  const out = [];
  for (const e of g.out(nodeId)) {
    if (seen.has(e.to)) continue;
    seen.add(e.to);
    const t = typeOf(g, e.to);
    if (t === "control") continue;
    if (t === "obligation" || t === "Obligations Node") {
      out.push(...obligationContinuations(e.to, g, seen));
    } else {
      out.push(e.to);
    }
  }
  return out;
}

function obligationForkStep(node, g, reason) {
  const ids = [...new Set(obligationContinuations(node.id, g))];
  if (ids.length === 0) return { kind: "terminal", reason };
  return {
    kind: "fork",
    prompt: norm(node.label),
    reason,
    branches: ids.map((id, i) => option(id, norm(g.node(id)?.label) || `Branch ${i + 1}`, id)),
  };
}

const RESOLVERS = {
  "Question Node": questionStep,
  "Yes Node": passThrough,
  "No Node": passThrough,
  "status node": statusStep,
  "if condition": ifConditionStep,
  "IF collector node": ifCollectorStep,
  obligation: (n, g) => obligationForkStep(n, g, "obligation reached"),
  "Obligations Node": (n, g) => obligationForkStep(n, g, "obligations reached"),
};

// Obligations encountered along the path. Landing on an "Obligations Node" (or a
// bare "obligation") pulls in every obligation under that heading - the whole
// subtree, nested Obligations Nodes included - grouped under the highest visited
// heading. A lone obligation forms a group of one.
export function collectObligations(path, g) {
  const visited = new Set(path);
  const isHeading = (id) => typeOf(g, id) === "Obligations Node";

  const mains = [];
  for (const id of path) {
    const t = typeOf(g, id);
    if (t !== "Obligations Node" && t !== "obligation") continue;

    let mainId = t === "obligation" ? g.in(id)[0]?.from ?? id : id;
    // climb to the topmost visited Obligations Node
    for (let p = g.in(mainId)[0]?.from; p && isHeading(p) && visited.has(p); p = g.in(p)[0]?.from) {
      mainId = p;
    }
    if (!mains.includes(mainId)) mains.push(mainId);
  }

  return mains.map((mainId) => ({
    mainId,
    mainLabel: norm(g.node(mainId)?.label) || "Obligations",
    items: descendantObligations(mainId, g),
  }));
}

function descendantObligations(mainId, g, seen = new Set()) {
  const items = [];
  for (const e of g.out(mainId)) {
    if (seen.has(e.to)) continue;
    seen.add(e.to);
    const t = typeOf(g, e.to);
    if (t === "obligation") items.push({ id: e.to, label: norm(g.node(e.to).label) });
    else if (t === "Obligations Node") items.push(...descendantObligations(e.to, g, seen));
  }
  return items;
}

// Statuses encountered along a visited path, in order.
export function collectStatuses(path, g) {
  return path
    .filter((id) => g.node(id)?.reverse_engineering_type === "status node")
    .map((id) => ({ id, label: norm(g.node(id).label) }));
}

export function resolveStep(nodeId, g) {
  const node = g.node(nodeId);
  if (!node) return { kind: "terminal", reason: "unknown node" };

  const resolver = RESOLVERS[node.reverse_engineering_type];
  if (resolver) return resolver(node, g);

  // Type not handled yet: stop, but offer plain "continue" links so the user
  // isn't stuck while the remaining scenarios are built out.
  const outs = g.out(nodeId);
  return {
    kind: "terminal",
    reason: `"${node.reverse_engineering_type}" not handled yet`,
    continuations: outs.map((e, i) =>
      option(e.id, norm(e.label) || norm(g.node(e.to)?.label) || `Continue ${i + 1}`, e.to),
    ),
  };
}
