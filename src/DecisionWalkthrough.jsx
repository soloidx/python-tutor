import React, { useState } from 'react';

export default function DecisionWalkthrough({ walkthrough, example, session }) {
  const [position, setPosition] = useState(session.walkthrough || { scenario: 0, step: 0 });
  const change = next => { session.walkthrough = next; setPosition(next); };
  const isSequence = walkthrough.type === 'sequence';
  const scenario = isSequence ? { steps: walkthrough.steps } : walkthrough.scenarios[position.scenario];
  const step = scenario.steps[position.step];
  const lines = example.split('\n');
  if (scenario.replacement) lines[scenario.replacement.line - 1] = scenario.replacement.code;
  const output = scenario.steps.slice(0, position.step + 1).flatMap(item => item.output ? [item.output] : []).join('\n');
  return <section className="walkthrough" aria-label="Recorrido interactivo">
    <h3>{isSequence ? 'Secuencia' : 'Decisión'}</h3>
    {!isSequence && <div className="walkthrough-scenarios" aria-label="Escenarios">{walkthrough.scenarios.map((item, index) => <button type="button" key={item.id} aria-pressed={index === position.scenario} onClick={() => change({ scenario:index, step:0 })}>{item.label}</button>)}</div>}
    <div className="walkthrough-layout"><div className="walkthrough-diagram">{walkthrough.elements.map(element => {
      const index = scenario.steps.findIndex(item => item.element === element.id);
      return index < 0 ? <div key={element.id} className="walkthrough-element">{element.label}</div> : <button type="button" key={element.id} className="walkthrough-element" aria-pressed={step.element === element.id} onClick={() => change({ ...position, step:index })}>{element.label}</button>;
    })}</div><div><pre className="walkthrough-code" aria-label="Código del recorrido">{lines.map((line, index) => <span key={index} className={step.line === index + 1 ? 'active' : ''}>{line}{'\n'}</span>)}</pre><p>{step.explanation}</p><div className="walkthrough-output"><strong>Salida</strong><pre aria-label="Salida del recorrido">{output}</pre></div></div></div>
    <div className="walkthrough-controls"><button type="button" aria-label="Anterior" disabled={position.step === 0} onClick={() => change({ ...position, step:position.step - 1 })}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4 7 12l8 8" /></svg>Anterior</button><span>{position.step + 1} / {scenario.steps.length}</span><button type="button" aria-label="Siguiente" disabled={position.step === scenario.steps.length - 1} onClick={() => change({ ...position, step:position.step + 1 })}>Siguiente<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 4 8 8-8 8" /></svg></button></div>
  </section>;
}
