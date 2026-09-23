// Shared inline styles + tiny formatting helpers for the navigation UI.

export const S = {
  panel: {
    position: "absolute", top: 12, right: 12, width: 330,
    maxHeight: "calc(100vh - 24px)", overflow: "auto",
    background: "rgba(255,255,255,0.97)", border: "1px solid #ccc",
    borderRadius: 10, padding: 14, fontSize: 13,
    boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 10,
  },
  btnPrimary: {
    padding: "7px 14px", borderRadius: 6, border: "1px solid #2563eb",
    background: "#2563eb", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600,
  },
  btnSecondary: {
    padding: "6px 12px", borderRadius: 6, border: "1px solid #999",
    background: "#f3f4f6", color: "#111", cursor: "pointer", fontSize: 12,
  },
  btnGhost: {
    padding: "3px 8px", borderRadius: 6, border: "1px solid #ccc",
    background: "#fff", cursor: "pointer", fontSize: 12,
  },
  linkBtn: {
    border: "none", background: "none", padding: 0, cursor: "pointer",
    color: "#1d4ed8", textAlign: "left", fontSize: 12, textDecoration: "underline",
  },
  tag: {
    marginLeft: 6, fontSize: 10, background: "#dbeafe", color: "#1e40af",
    borderRadius: 4, padding: "1px 5px",
  },
  note: {
    fontSize: 11, color: "#92400e", background: "#fef3c7",
    borderRadius: 6, padding: "6px 8px",
  },
  statusChip: {
    display: "block", width: "100%", textAlign: "left", cursor: "pointer",
    fontSize: 12, fontWeight: 600, color: "#075985",
    background: "#e0f2fe", border: "1px solid #7dd3fc", borderRadius: 6, padding: "5px 8px",
  },
  obligationChip: {
    display: "block", width: "100%", textAlign: "left",
    fontSize: 12, fontWeight: 700, color: "#4a1712",
    background: "rgb(217, 167, 161)", border: "1px solid rgb(197, 140, 133)", borderRadius: 6, padding: "4px 8px",
  },
  groupHead: {
    fontSize: 11, fontWeight: 700, color: "#7f2c22", margin: "6px 0 3px",
  },
  detailToggle: {
    fontSize: 11, fontWeight: 600, color: "#7f2c22",
    cursor: "pointer", padding: "3px 0", userSelect: "none",
  },
  detailList: {
    margin: "2px 0 4px", paddingLeft: 14, listStyle: "disc",
    fontSize: 11, lineHeight: 1.45, color: "#4a3430",
  },
  checkRow: { display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, cursor: "pointer" },
  sectionLabel: {
    fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, color: "#666", marginBottom: 6,
  },
  section: { marginTop: 16, borderTop: "1px solid #eee", paddingTop: 10 },
  card: {
    border: "1px solid #d4d4d8", borderLeft: "3px solid #2563eb",
    borderRadius: 8, padding: "8px 10px", background: "#fff",
  },
};

export const truncate = (s, n = 64) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export const fmtAnswer = (a) => (Array.isArray(a) ? a.join(", ") : String(a));
