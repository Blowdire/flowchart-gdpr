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
// Any step may also carry `visits: [nodeId]` - extra nodes the step covers
// wholesale (an obligation block's duties and their detail), which the engine
// marks visited on arrival.
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
//
// When a status has several outgoing edges they are not mutually exclusive
// options - in the data they're independent obligations/questions that all
// apply at once (e.g. "You are an independent data controller" -> an
// obligation IF you've onboarded a processor, AND a follow-up question). So,
// like obligations, this is a parallel fork behind a "Next" button, not a
// single choice.
function statusStep(node, g) {
  const outs = g.out(node.id);
  if (outs.length === 1) return { kind: "auto", to: outs[0].to };
  if (outs.length === 0) return { kind: "terminal", reason: "status reached" };
  return {
    kind: "fork",
    prompt: norm(node.label),
    reason: "status reached",
    branches: outs.map((e, i) =>
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

// Some obligation headings aren't typed "Obligations Node" in the source data -
// e.g. an "unknown" node whose label is a plain-English preamble ("IF you have
// onboarded a data processor, ensure the following:") but whose children are
// entirely obligations. Recognise those by shape rather than by type.
function isObligationHeading(nodeId, g) {
  if (typeOf(g, nodeId) === "Obligations Node") return true;
  const kids = g.out(nodeId).map((e) => typeOf(g, e.to));
  return kids.length > 0 && kids.every((t) => t === "obligation" || t === "Obligations Node");
}

// An obligation's own *content* rather than a step in the flow: the control
// bullets, their elements, and explanatory prose. These are never decisions, but
// the flowchart does sometimes resume on the far side of them (a control leading
// on to another obligation, an element feeding an IF collector), so they must be
// walked through rather than treated as dead ends.
const DETAIL_TYPES = new Set([
  "control",
  "Elements of control/obligation",
  "Explanatory Node",
]);

const isObligationContent = (id, g) => {
  const t = typeOf(g, id);
  return DETAIL_TYPES.has(t) || t === "obligation" || isObligationHeading(id, g);
};

// Obligation / Obligations Node (or an obligation-shaped "unknown" node): a duty
// (or heading of duties) the path has landed on. Flatten through the whole
// obligation block - nested duties and all their detail - down to the real
// downstream flow nodes, and offer those as parallel branches behind "Next".
function obligationContinuations(nodeId, g, seen = new Set()) {
  const out = [];
  for (const e of g.out(nodeId)) {
    if (seen.has(e.to)) continue;
    seen.add(e.to);
    if (isObligationContent(e.to, g)) out.push(...obligationContinuations(e.to, g, seen));
    else out.push(e.to);
  }
  return out;
}

// Every node making up this obligation block, so the engine can mark the whole
// thing visited when the user passes through it.
function obligationSubtree(nodeId, g, seen = new Set([nodeId])) {
  const ids = [];
  for (const e of g.out(nodeId)) {
    if (seen.has(e.to) || !isObligationContent(e.to, g)) continue;
    seen.add(e.to);
    ids.push(e.to, ...obligationSubtree(e.to, g, seen));
  }
  return ids;
}

function obligationForkStep(node, g, reason) {
  const visits = obligationSubtree(node.id, g);
  const ids = [...new Set(obligationContinuations(node.id, g))];
  if (ids.length === 0) return { kind: "terminal", reason, visits };
  return {
    kind: "fork",
    prompt: norm(node.label),
    reason,
    visits,
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

  // A heading can have several parents (the same duties are reused under more
  // than one heading), so look across all in-edges, not just the first.
  const headingParent = (id) =>
    g.in(id).map((e) => e.from).find((p) => isObligationHeading(p, g) && visited.has(p));

  const mains = [];
  for (const id of path) {
    const t = typeOf(g, id);
    let mainId;
    if (isObligationHeading(id, g)) mainId = id;
    else if (t === "obligation") mainId = g.in(id)[0]?.from ?? id;
    else continue;

    // climb to the topmost visited heading
    const climbed = new Set([mainId]);
    for (let p = headingParent(mainId); p && !climbed.has(p); p = headingParent(mainId)) {
      climbed.add(p);
      mainId = p;
    }
    if (!mains.includes(mainId)) mains.push(mainId);
  }

  // Duties shared between overlapping headings belong to the first group that
  // claims them, so nothing is listed twice.
  const claimed = new Set();
  return mains
    .map((mainId) => ({
      mainId,
      mainLabel: norm(g.node(mainId)?.label) || "Obligations",
      items: descendantObligations(mainId, g, new Set(), claimed),
    }))
    .filter((grp) => grp.items.length > 0);
}

function descendantObligations(mainId, g, seen = new Set(), claimed = new Set()) {
  const items = [];
  for (const e of g.out(mainId)) {
    if (seen.has(e.to)) continue;
    seen.add(e.to);
    const t = typeOf(g, e.to);
    if (t === "obligation") {
      if (claimed.has(e.to)) continue;
      claimed.add(e.to);
      items.push({
        id: e.to,
        label: norm(g.node(e.to).label),
        details: obligationDetails(e.to, g),
      });
    } else if (isObligationHeading(e.to, g)) {
      items.push(...descendantObligations(e.to, g, seen, claimed));
    }
  }
  return items;
}

// The substance of an obligation: its control ("Data Processing Agreement") and
// the elements that control breaks down into, nested as they are in the chart.
// These carry the actual requirements, so they're collected for display rather
// than just walked past.
function obligationDetails(nodeId, g, seen = new Set()) {
  const items = [];
  for (const e of g.out(nodeId)) {
    const t = typeOf(g, e.to);
    if (!DETAIL_TYPES.has(t) || seen.has(e.to)) continue;
    seen.add(e.to);
    items.push({
      id: e.to,
      label: norm(g.node(e.to).label),
      type: t,
      children: obligationDetails(e.to, g, seen),
    });
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

  // An unhandled type that fans out purely into obligations is an obligation
  // heading in disguise (e.g. an "unknown"-typed "IF you have onboarded a data
  // processor, ensure the following:" preamble) - treat it like one.
  if (isObligationHeading(nodeId, g)) {
    return obligationForkStep(node, g, `obligations reached (${node.reverse_engineering_type})`);
  }

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
