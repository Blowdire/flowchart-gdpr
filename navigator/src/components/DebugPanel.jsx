import { useState } from 'react';

export default function DebugPanel({ activeIds, checks, nodeMap }) {
  const [open, setOpen] = useState(false);

  if (!import.meta.env.DEV) return null;

  const payload = {
    activeIds,
    checks,
    activeNodes: activeIds.map(id => nodeMap[id]).filter(Boolean),
  };

  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
      fontFamily: 'monospace', fontSize: 12,
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: '#1e1e2e', color: '#cdd6f4', border: 'none',
          borderRadius: 6, padding: '5px 12px', cursor: 'pointer',
          display: 'block', marginLeft: 'auto', marginBottom: 4,
        }}
      >
        {open ? '✕ close debug' : '🐛 debug'}
      </button>
      {open && (
        <pre style={{
          background: '#1e1e2e', color: '#cdd6f4',
          margin: 0, padding: 14, borderRadius: 8,
          maxWidth: 480, maxHeight: '60vh',
          overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </div>
  );
}
