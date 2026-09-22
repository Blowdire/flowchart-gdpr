import { useState } from "react";
import { S } from "./ui.js";

// Renders the interactive part of the current node: a single choice, a
// multi-select (if-condition group), or a terminal state.
export default function StepPrompt({ step, onChoose, onSubmit, onProceed }) {
  if (step.kind === "fork") {
    const many = step.branches.length > 1;
    return (
      <div style={{ marginTop: 12 }}>
        {many && (
          <div style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>
            {step.branches.length} parallel branches continue from here:
          </div>
        )}
        {many && (
          <ul style={{ margin: "0 0 8px", paddingLeft: 18, fontSize: 12, color: "#555" }}>
            {step.branches.map((b) => <li key={b.key}>{b.label}</li>)}
          </ul>
        )}
        <button style={S.btnPrimary} onClick={onProceed}>Next →</button>
      </div>
    );
  }

  if (step.kind === "choice") {
    return (
      <div style={{ marginTop: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {step.options.map((o) => (
            <button key={o.key} onClick={() => onChoose(o)} style={S.btnPrimary}>{o.label}</button>
          ))}
        </div>
        {step.unhandled && (
          <div style={{ ...S.note, marginTop: 8 }}>
            Not a yes/no question — showing raw branches for now.
          </div>
        )}
      </div>
    );
  }

  if (step.kind === "multi") {
    return <MultiChoice step={step} onSubmit={onSubmit} />;
  }

  if (step.kind === "terminal") {
    if (step.continuations?.length) {
      return (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>
            {step.reason ? `${step.reason} — continue:` : "Continue:"}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {step.continuations.map((c) => (
              <button key={c.key} onClick={() => onChoose(c)} style={S.btnSecondary}>{c.label}</button>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div style={{ ...S.note, marginTop: 12 }}>
        End of path{step.reason ? ` — ${step.reason}` : ""}.
      </div>
    );
  }

  return null;
}

function MultiChoice({ step, onSubmit }) {
  const [selected, setSelected] = useState(() => new Set());

  const toggle = (key) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, color: "#666", marginBottom: 8 }}>
        Select all that apply — combined with <strong>{step.connective}</strong>.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {step.options.map((o) => (
          <label key={o.key} style={S.checkRow}>
            <input type="checkbox" checked={selected.has(o.key)} onChange={() => toggle(o.key)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      <button style={{ ...S.btnPrimary, marginTop: 10 }} onClick={() => onSubmit([...selected])}>
        Submit ({selected.size})
      </button>
    </div>
  );
}
