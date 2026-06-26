import rawData from './flowchart.json';
import { parseFlowchart } from './parseFlowchart';
import { useNavigator } from './useNavigator';
import Card from './components/Card';
import DebugPanel from './components/DebugPanel';
import './App.css';

const graph = parseFlowchart(rawData);

export default function App() {
  const nav = useNavigator(graph, '1');
  const {
    activeIds, checks, conclusions, canGoBack,
    isSimple, isCollector, isDecision, isTerminal, evalConds,
    stepAll, goBack, answer, choosePath, resolveConditions, toggleCondition, reset,
  } = nav;

  const validIds   = activeIds.filter(Boolean);
  const canAdvance = validIds.some(n => !isDecision(n) && !isTerminal(n));
  const done       = validIds.length > 0 && validIds.every(isTerminal);
  // plain nodes = not a decision, not terminal — when multiple are active, each gets a "Choose" button
  const multipleChoices = validIds.filter(n => !isDecision(n) && !isTerminal(n)).length > 1;

  return (
    <div className="app">
      <h1>GDPR Flowchart Navigator</h1>

      <div className="app-body">
        <div className="app-main">
          <div className="cards">
            {validIds.map(nid => {
              const node = graph.nodeMap[nid];
              if (!node) return null;
              return (
                <Card
                  key={nid}
                  node={node}
                  isSimple={isSimple(nid)}
                  isCollector={isCollector(nid)}
                  isTerminal={isTerminal(nid)}
                  isChoice={multipleChoices && !isDecision(nid) && !isTerminal(nid)}
                  collectorCtx={graph.collectorIfMap[nid]}
                  checks={checks}
                  evalConds={evalConds}
                  onAnswer={answer}
                  onChoose={choosePath}
                  onToggleCondition={toggleCondition}
                  onResolve={resolveConditions}
                />
              );
            })}
          </div>

          <div className="controls">
            <button className="btn btn-back" disabled={!canGoBack} onClick={goBack}>← Back</button>
            {canAdvance && (
              <button className="btn btn-next" onClick={stepAll}>Next →</button>
            )}
            {done && <span className="done">✓ All paths complete.</span>}
            <button className="btn btn-restart" onClick={reset}>↺ Restart</button>
          </div>
        </div>

        {conclusions.length > 0 && (
          <aside className="conclusions-panel">
            <h2>Intermediate Conclusions</h2>
            <ul>
              {conclusions.map(n => (
                <li key={n.id} className="conclusion-item">
                  {(n.label ?? '').replace(/\n/g, ' ').trim()}
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>

      <DebugPanel activeIds={activeIds} checks={checks} nodeMap={graph.nodeMap} />
    </div>
  );
}
