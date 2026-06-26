const norm = s => (s ?? '').toLowerCase().replace(/\n/g, ' ').trim();

export function parseFlowchart(data) {
  const nodeMap = Object.fromEntries(data.nodes.map(n => [n.id, n]));

  const outgoing = {};
  const incoming = {};
  for (const e of data.edges) {
    if (e.from) (outgoing[e.from] ??= []).push(e);
    if (e.to)   (incoming[e.to]   ??= []).push(e);
  }

  const yesIds       = new Set(data.nodes.filter(n => n.reverse_engineering_type === 'Yes Node').map(n => n.id));
  const noIds        = new Set(data.nodes.filter(n => n.reverse_engineering_type === 'No Node').map(n => n.id));
  const collectorIds = new Set(data.nodes.filter(n => n.reverse_engineering_type === 'IF collector node').map(n => n.id));

  // simple if nodes: Question Node → Yes Node / No Node
  const simpleIfMap = {};
  const seenParents = new Set();
  for (const yesId of yesIds) {
    for (const edge of (incoming[yesId] ?? [])) {
      const parentId = edge.from;
      if (seenParents.has(parentId) || collectorIds.has(parentId)) continue;
      seenParents.add(parentId);
      const noId = (outgoing[parentId] ?? []).find(e => noIds.has(e.to))?.to ?? null;
      simpleIfMap[parentId] = { yes_node: yesId, no_node: noId };
    }
  }

  // collector if nodes
  const collectorIfMap = {};
  for (const node of data.nodes) {
    if (node.reverse_engineering_type !== 'IF collector node') continue;
    const nodeId = node.id;
    const conditions = data.edges.filter(e => e.to === nodeId).map(e => e.from).filter(Boolean);
    const condSet = new Set(conditions);
    const orConditions  = [...new Set(
      data.edges.filter(e => condSet.has(e.from) && norm(e.label) === 'or')
               .flatMap(e => [e.from, e.to]).filter(x => x !== nodeId)
    )];
    const andConditions = [...new Set(
      data.edges.filter(e => condSet.has(e.from) && norm(e.label) === 'and')
               .flatMap(e => [e.from, e.to]).filter(x => x !== nodeId)
    )];
    collectorIfMap[nodeId] = {
      conditions,
      condition_details: conditions.map(c => nodeMap[c]).filter(Boolean),
      or_conditions:  orConditions,
      and_conditions: andConditions,
      output_nodes: (outgoing[nodeId] ?? []).map(e => e.to),
    };
  }

  // map every condition node → its parent collector so navigation can skip them
  const conditionToCollector = {};
  for (const [collectorId, ctx] of Object.entries(collectorIfMap)) {
    for (const condId of ctx.conditions) {
      conditionToCollector[condId] = collectorId;
    }
  }

  return { nodeMap, outgoing, collectorIfMap, simpleIfMap, conditionToCollector };
}
