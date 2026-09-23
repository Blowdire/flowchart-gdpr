import { S } from "./ui.js";

// Obligations grouped under their heading. Each obligation carries its own
// substance - the control it maps to and the elements that control breaks down
// into - collapsed by default so a long requirements list doesn't bury the rest
// of the panel.
export default function ObligationList({ groups, visited, onJump }) {
  if (groups.length === 0) return <div style={{ fontSize: 12, color: "#999" }}>None yet.</div>;

  return groups.map((grp) => (
    <div key={grp.mainId}>
      {grp.items.length > 1 && <div style={S.groupHead}>{grp.mainLabel}</div>}
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
        {grp.items.map((item) => {
          const seen = visited.has(item.id);
          return (
            <li key={item.id}>
              <button
                onClick={() => onJump(item.id)}
                disabled={!seen}
                style={{ ...S.obligationChip, cursor: seen ? "pointer" : "default", opacity: seen ? 1 : 0.6 }}
              >
                {item.label || item.id}
              </button>
              {item.details.map((d) => <DetailBranch key={d.id} detail={d} />)}
            </li>
          );
        })}
      </ul>
    </div>
  ));
}

function DetailBranch({ detail }) {
  if (detail.children.length === 0) return <DetailLeaves items={[detail]} />;
  return (
    <details>
      <summary style={S.detailToggle}>
        {detail.label} ({countLeaves(detail)})
      </summary>
      <DetailLeaves items={detail.children} />
    </details>
  );
}

function DetailLeaves({ items }) {
  return (
    <ul style={S.detailList}>
      {items.map((it) => (
        <li key={it.id}>
          {it.label}
          {it.children.length > 0 && <DetailLeaves items={it.children} />}
        </li>
      ))}
    </ul>
  );
}

const countLeaves = (d) =>
  d.children.length === 0 ? 1 : d.children.reduce((n, c) => n + countLeaves(c), 0);
