import { resolveStep } from "./resolvers.js";
import { evaluateGroup } from "./patterns/ifGroup.js";

// Navigation state is a *frontier* of active nodes, not a single cursor, so
// parallel branches (an Obligations Node that fans out into several ongoing
// paths) are all live at once.
//
//   state = {
//     visited:  string[]            // every node touched, in order
//     frontier: { id, step }[]      // nodes awaiting the user
//     answers:  { [nodeId]: string | string[] }
//   }
//
// All functions here are pure: (state, g, ...) -> new state.

// Walk from `startId` through `auto` steps, recording each node in `visited`,
// and return the node where it comes to rest plus that node's step.
function settle(g, startId, visited) {
  let cur = startId;
  const local = new Set();
  while (cur != null && !local.has(cur)) {
    local.add(cur);
    if (!visited.includes(cur)) visited.push(cur);
    const step = resolveStep(cur, g);
    if (step.kind === "auto" && step.to != null) {
      cur = step.to;
      continue;
    }
    return { id: cur, step };
  }
  return { id: cur, step: { kind: "terminal", reason: "loop or dead end" } };
}

const dedupe = (entries) => {
  const seen = new Set();
  return entries.filter((e) => (seen.has(e.id) ? false : seen.add(e.id)));
};

// A settled endpoint with nothing left to do - keep it only if it's the last
// thing standing, so the user always sees where a path ended.
const isActionable = (f) =>
  f.step.kind !== "terminal" || (f.step.continuations?.length ?? 0) > 0;

const prune = (entries) => {
  const all = dedupe(entries);
  const live = all.filter(isActionable);
  return live.length > 0 ? live : all.slice(-1);
};

// Replace one frontier entry, in place, with the settled result of advancing to
// `targets`. Keeping the position stable matters: acting on the 2nd branch must
// not shuffle the list under the user.
function expand(state, g, entryId, targets, answerPatch) {
  const visited = [...state.visited];
  const landed = targets.filter((t) => t != null).map((t) => settle(g, t, visited));
  const next = state.frontier.flatMap((f) => (f.id === entryId ? landed : [f]));
  return {
    visited,
    frontier: prune(next),
    answers: { ...state.answers, ...answerPatch },
  };
}

export function initState(g) {
  const visited = [];
  return { visited, frontier: [settle(g, g.start, visited)], answers: {} };
}

// Pick one option at a `choice` entry.
export function choose(state, g, entryId, opt) {
  if (opt?.to == null) return state;
  return expand(state, g, entryId, [opt.to], { [entryId]: opt.answerLabel ?? opt.key });
}

// "Next" at a `fork` (or a `terminal` with continuations): every branch becomes
// live in parallel.
export function proceed(state, g, entryId) {
  const entry = state.frontier.find((f) => f.id === entryId);
  const branches = entry?.step.branches ?? entry?.step.continuations ?? [];
  if (branches.length === 0) return state;
  return expand(state, g, entryId, branches.map((b) => b.to), {});
}

// Submit selections at a `multi` entry (if-condition group -> collector Yes/No).
export function submit(state, g, entryId, keys) {
  const entry = state.frontier.find((f) => f.id === entryId);
  if (entry?.step.kind !== "multi") return state;

  const selected = new Set(keys);
  const { group } = entry.step;
  const picked = group.conditions.filter((c) => selected.has(c.id));

  const visited = [...state.visited];
  for (const id of [...picked.map((c) => c.id), group.collectorId]) {
    if (!visited.includes(id)) visited.push(id);
  }
  const landed = settle(g, evaluateGroup(group, selected), visited);
  const next = state.frontier.flatMap((f) => (f.id === entryId ? [landed] : [f]));

  return {
    visited,
    frontier: prune(next),
    answers: {
      ...state.answers,
      [entryId]: picked.length ? picked.map((c) => c.label) : ["(none apply)"],
    },
  };
}

// Rewind to an already-visited node: drop everything after it and make it the
// sole frontier entry.
export function jumpTo(state, g, nodeId) {
  const idx = state.visited.indexOf(nodeId);
  if (idx < 0) return state;
  const visited = state.visited.slice(0, idx);
  const frontier = [settle(g, nodeId, visited)];
  const answers = {};
  for (const [k, v] of Object.entries(state.answers)) {
    if (visited.includes(k)) answers[k] = v;
  }
  return { visited, frontier, answers };
}
