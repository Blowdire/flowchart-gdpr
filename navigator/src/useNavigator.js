import { useState, useCallback, useEffect, useRef } from 'react';

export function useNavigator({ nodeMap, outgoing, collectorIfMap, simpleIfMap, conditionToCollector }, startId) {
  const [activeIds, setActiveIds]     = useState([startId]);
  const [checks, setChecks]           = useState({});
  const [conclusions, setConclusions] = useState([]);  // visited Intermediate Conclusion nodes
  const historyRef = useRef([]);  // stack of { activeIds, checks } snapshots

  // Track intermediate conclusions whenever activeIds changes
  useEffect(() => {
    const newConclusions = activeIds
      .map(id => nodeMap[id])
      .filter(n => n?.reverse_engineering_type === 'Intermediate Conclusion');
    if (!newConclusions.length) return;
    setConclusions(prev => {
      const existingIds = new Set(prev.map(n => n.id));
      const toAdd = newConclusions.filter(n => !existingIds.has(n.id));
      return toAdd.length ? [...prev, ...toAdd] : prev;
    });
  }, [activeIds, nodeMap]);

  const isSimple    = id => id in simpleIfMap;
  const isCollector = id => id in collectorIfMap;
  const isDecision  = id => isSimple(id) || isCollector(id);
  const isTerminal  = id => !(outgoing[id]?.length);

  const evalConds = useCallback((ifId) => {
    const ctx  = collectorIfMap[ifId];
    const ch   = checks[ifId] ?? {};
    const orC  = ctx.or_conditions  ?? [];
    const andC = ctx.and_conditions ?? [];
    if (!orC.length && !andC.length) return ctx.conditions.some(c => ch[c]);
    return (!orC.length || orC.some(c => ch[c])) &&
           (!andC.length || andC.every(c => ch[c]));
  }, [collectorIfMap, checks]);

  // Save current state before every mutating action
  const pushHistory = useCallback((currentIds, currentChecks) => {
    historyRef.current = [...historyRef.current, { activeIds: currentIds, checks: currentChecks }];
  }, []);

  const goBack = useCallback(() => {
    if (!historyRef.current.length) return;
    const prev = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    setActiveIds(prev.activeIds);
    setChecks(prev.checks);
  }, []);

  const stepAll = useCallback(() => {
    const resolve = id => conditionToCollector[id] ?? id;
    setActiveIds(prev => {
      pushHistory(prev, checks);
      const seen = new Set(), next = [];
      for (const nid of prev) {
        const rid = resolve(nid);
        if (rid !== nid) {
          // condition node → jump straight to its collector
          if (!seen.has(rid)) { next.push(rid); seen.add(rid); }
          continue;
        }
        if (isDecision(nid) || isTerminal(nid)) {
          if (!seen.has(nid)) { next.push(nid); seen.add(nid); }
          continue;
        }
        const ns = (outgoing[nid] ?? []).map(e => e.to).filter(Boolean);
        for (const n of (ns.length ? ns : [nid])) {
          const rn = resolve(n);
          if (!seen.has(rn)) { next.push(rn); seen.add(rn); }
        }
      }
      return next;
    });
  }, [outgoing, isDecision, isTerminal, checks, pushHistory, conditionToCollector]);

  const answer = useCallback((nodeId, choice) => {
    const yesNoId = choice === 'yes'
      ? simpleIfMap[nodeId].yes_node
      : simpleIfMap[nodeId].no_node;
    // if there's no branch (e.g. no No node), remove this node from active without adding anything
    if (!yesNoId) {
      setActiveIds(prev => {
        pushHistory(prev, checks);
        return prev.filter(id => id !== nodeId);
      });
      return;
    }
    // skip the Yes/No node itself, go straight to its successors
    const successors = (outgoing[yesNoId] ?? []).map(e => e.to).filter(Boolean);
    const targets = successors.length ? successors : [yesNoId];
    setActiveIds(prev => {
      pushHistory(prev, checks);
      const seen = new Set(), next = [];
      for (const nid of prev) {
        for (const dest of (nid === nodeId ? targets : [nid]))
          if (!seen.has(dest)) { next.push(dest); seen.add(dest); }
      }
      return next;
    });
  }, [simpleIfMap, outgoing, checks, pushHistory]);

  const resolveConditions = useCallback((ifId) => {
    const outputs = collectorIfMap[ifId].output_nodes ?? [];
    setActiveIds(prev => {
      pushHistory(prev, checks);
      const seen = new Set(), next = [];
      for (const nid of prev)
        for (const t of (nid === ifId ? outputs : [nid]))
          if (!seen.has(t)) { next.push(t); seen.add(t); }
      return next;
    });
  }, [collectorIfMap, checks, pushHistory]);

  const choosePath = useCallback((nodeId) => {
    setActiveIds(prev => {
      pushHistory(prev, checks);
      return [nodeId];
    });
  }, [checks, pushHistory]);

  const toggleCondition = useCallback((ifId, condId) => {
    setChecks(prev => ({
      ...prev,
      [ifId]: { ...(prev[ifId] ?? {}), [condId]: !(prev[ifId]?.[condId]) },
    }));
  }, []);

  const reset = useCallback(() => {
    historyRef.current = [];
    setActiveIds([startId]);
    setChecks({});
    setConclusions([]);
  }, [startId]);

  return {
    activeIds, checks, conclusions,
    canGoBack: historyRef.current.length > 0,
    isSimple, isCollector, isDecision, isTerminal, evalConds,
    stepAll, goBack, answer, choosePath, resolveConditions, toggleCondition, reset,
  };
}
