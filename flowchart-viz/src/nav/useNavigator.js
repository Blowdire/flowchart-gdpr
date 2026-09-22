import { useCallback, useMemo, useState } from "react";
import { buildIndex } from "./graphIndex.js";
import * as F from "./frontier.js";

// Thin React wrapper around the pure frontier engine, with a full-state undo
// stack for "Back".
export function useNavigator(data) {
  const g = useMemo(() => buildIndex(data), [data]);
  const [stack, setStack] = useState(() => [F.initState(g)]);
  const state = stack[stack.length - 1];

  const act = useCallback((fn) => {
    setStack((s) => {
      const prev = s[s.length - 1];
      const next = fn(prev);
      return next === prev ? s : [...s, next];
    });
  }, []);

  const choose = useCallback((entryId, opt) => act((s) => F.choose(s, g, entryId, opt)), [act, g]);
  const submit = useCallback((entryId, keys) => act((s) => F.submit(s, g, entryId, keys)), [act, g]);
  const proceed = useCallback((entryId) => act((s) => F.proceed(s, g, entryId)), [act, g]);
  const jumpTo = useCallback((id) => act((s) => F.jumpTo(s, g, id)), [act, g]);
  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  const reset = useCallback(() => setStack([F.initState(g)]), [g]);

  return { g, ...state, choose, submit, proceed, jumpTo, back, reset, canBack: stack.length > 1 };
}
