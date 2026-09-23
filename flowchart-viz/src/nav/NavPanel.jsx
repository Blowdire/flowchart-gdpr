import { norm } from "./graphIndex.js";
import { collectStatuses, collectObligations } from "./resolvers.js";
import StepPrompt from "./StepPrompt.jsx";
import ObligationList from "./ObligationList.jsx";
import { S, truncate, fmtAnswer } from "./ui.js";

export default function NavPanel({ nav }) {
  const { g, frontier, visited, answers, choose, submit, proceed, jumpTo, back, reset, canBack } = nav;
  const statuses = collectStatuses(visited, g);
  const obligationGroups = collectObligations(visited, g);
  const obligationCount = obligationGroups.reduce((sum, grp) => sum + grp.items.length, 0);
  const visitedSet = new Set(visited);

  return (
    <div style={S.panel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <strong>Interactive navigation</strong>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={back} style={S.btnGhost} disabled={!canBack}>Back</button>
          <button onClick={reset} style={S.btnGhost}>Reset</button>
        </div>
      </div>

      <div style={{ ...S.sectionLabel, marginTop: 12 }}>
        Active{frontier.length > 1 ? ` — ${frontier.length} parallel` : ""}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {frontier.map((entry) => {
          const node = g.node(entry.id);
          return (
            <div key={entry.id} style={S.card}>
              <div style={{ ...S.sectionLabel, marginBottom: 3 }}>
                {node?.reverse_engineering_type ?? "—"}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{norm(node?.label) || "(no label)"}</div>
              <StepPrompt
                key={entry.id}
                step={entry.step}
                onChoose={(opt) => choose(entry.id, opt)}
                onSubmit={(keys) => submit(entry.id, keys)}
                onProceed={() => proceed(entry.id)}
              />
            </div>
          );
        })}
      </div>

      <div style={S.section}>
        <div style={S.sectionLabel}>Statuses reached ({statuses.length})</div>
        {statuses.length === 0 ? (
          <div style={{ fontSize: 12, color: "#999" }}>None yet.</div>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
            {statuses.map((s, i) => (
              <li key={`${s.id}-${i}`}>
                <button onClick={() => jumpTo(s.id)} style={S.statusChip}>{s.label || s.id}</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={S.section}>
        <div style={S.sectionLabel}>Obligations ({obligationCount})</div>
        <ObligationList groups={obligationGroups} visited={visitedSet} onJump={jumpTo} />
      </div>

      <div style={S.section}>
        <div style={S.sectionLabel}>Visited ({visited.length})</div>
        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
          {visited.map((id) => {
            const n = g.node(id);
            return (
              <li key={id}>
                <button onClick={() => jumpTo(id)} style={S.linkBtn}>
                  {truncate(norm(n?.label) || n?.reverse_engineering_type || id)}
                </button>
                {answers[id] && <span style={S.tag}>{truncate(fmtAnswer(answers[id]), 40)}</span>}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
