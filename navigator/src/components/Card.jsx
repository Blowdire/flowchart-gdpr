export default function Card({
  node, isSimple, isCollector, isTerminal, isChoice,
  collectorCtx, checks,
  evalConds, onAnswer, onChoose, onToggleCondition, onResolve,
}) {
  const label = (node.label ?? '').replace(/\n/g, ' ').trim() || '(no label)';
  const color = node.color ?? '#f0f0f0';

  return (
    <div style={{ background: color }} className="card">
      <div className="card-title">{label}</div>
      <div className="card-meta">{node.reverse_engineering_type} · ID: {node.id}</div>

      {isCollector && collectorCtx && (
        <CollectorBody
          nid={node.id}
          ctx={collectorCtx}
          checks={checks}
          evalConds={evalConds}
          onToggle={onToggleCondition}
          onResolve={onResolve}
        />
      )}

      {isSimple && (
        <div className="yesno">
          <button className="btn btn-yes" onClick={() => onAnswer(node.id, 'yes')}>Yes</button>
          <button className="btn btn-no"  onClick={() => onAnswer(node.id, 'no')}>No</button>
        </div>
      )}

      {isChoice && (
        <button className="btn btn-choose" onClick={() => onChoose(node.id)}>
          Choose this path →
        </button>
      )}

      {isTerminal && (
        <div className="terminal">✓ Terminal</div>
      )}
    </div>
  );
}

function CollectorBody({ nid, ctx, checks, evalConds, onToggle, onResolve }) {
  const orSet  = new Set(ctx.or_conditions  ?? []);
  const andSet = new Set(ctx.and_conditions ?? []);
  const ch     = checks[nid] ?? {};
  const anyChecked = Object.values(ch).some(Boolean);
  const sat        = evalConds(nid);

  return (
    <>
      <div className="clist">
        {(ctx.condition_details ?? []).map(cd => {
          const tag = andSet.has(cd.id) ? ' [AND]' : orSet.has(cd.id) ? ' [OR]' : '';
          const lbl = (cd.label ?? '').replace(/\n/g, ' ').trim();
          return (
            <button
              key={cd.id}
              className={`citem${ch[cd.id] ? ' active' : ''}`}
              onClick={() => onToggle(nid, cd.id)}
            >
              {lbl}{tag && <b> {tag.trim()}</b>}
            </button>
          );
        })}
      </div>
      {anyChecked && (
        <div className={`status ${sat ? 'met' : 'unmet'}`}>
          {sat ? '✓ Conditions met' : '○ Not yet met'}
        </div>
      )}
      <button
        className="btn btn-proceed"
        onClick={() => onResolve(nid)}
      >
        Proceed →
      </button>
    </>
  );
}
