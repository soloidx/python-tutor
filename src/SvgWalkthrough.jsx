import React, { createElement, useMemo, useState } from "react";
import { Icon } from "./Icon.jsx";
import { parseWalkthroughSvg } from "./walkthroughSvg.js";
import { visibleWalkthrough } from "./walkthroughState.js";

const svgProps = {
  "font-size": "fontSize",
  "stroke-width": "strokeWidth",
  "text-anchor": "textAnchor",
};

function renderNode(node, step, key, imageLabel) {
  if (typeof node === "string") return node;
  const props = { key };
  for (const [name, value] of Object.entries(node.props)) {
    if (name !== "data-hidden") props[svgProps[name] ?? name] = value;
  }
  if (node.name === "svg") {
    props.role = "img";
    if (!node.children.some(child => child.name === "title")) props["aria-label"] = imageLabel;
  }

  const part = node.props["data-part"];
  if (part) {
    const hidden = step.hide?.includes(part) || (node.props["data-hidden"] === "true" && !step.show?.includes(part));
    if (hidden) {
      props["data-walkthrough-hidden"] = "";
      props["aria-hidden"] = true;
    }
    if (step.highlight?.includes(part)) props["data-walkthrough-highlight"] = "";
    if (step.animate?.includes(part)) props["data-walkthrough-animate"] = "";
  }
  return createElement(node.name, props, node.children.map((child, index) => renderNode(child, step, index)));
}

export default function SvgWalkthrough({ walkthrough, example, session }) {
  const [position, setPosition] = useState(session.walkthrough || { scenario: 0, step: 0 });
  const scenario = walkthrough.scenarios[position.scenario];
  const step = scenario.steps[position.step];
  const { code, output, stepNumber, stepCount } = visibleWalkthrough(walkthrough, example, position);
  const source = walkthrough.graphics[scenario.graphic];
  const graphic = useMemo(() => parseWalkthroughSvg(source).root, [source]);

  function change(next) {
    session.walkthrough = next;
    setPosition(next);
  }

  return (
    <section className="walkthrough svg-walkthrough" aria-label="Recorrido interactivo">
      {walkthrough.scenarios.length > 1 && (
        <div className="svg-walkthrough-scenarios" role="group" aria-label="Escenarios">
          {walkthrough.scenarios.map((item, index) => (
            <button key={item.id} type="button" aria-pressed={index === position.scenario}
              onClick={() => change({ scenario: index, step: 0 })}>
              {item.label}
            </button>
          ))}
        </div>
      )}
      <div className={code ? "svg-walkthrough-scene has-code" : "svg-walkthrough-scene"}>
        <div className="svg-walkthrough-graphic">
          {renderNode(graphic, step, `${scenario.id}:${stepNumber}`, scenario.label)}
        </div>
        {code && (
          <pre className="walkthrough-code svg-walkthrough-code" aria-label="Código del recorrido"><code>
            {code.split("\n").map((line, index) => (
              <span key={index} aria-current={step.line === index + 1 ? "step" : undefined}>
                {line}{"\n"}
              </span>
            ))}
          </code></pre>
        )}
      </div>
      <div className="svg-walkthrough-readout" aria-live="polite">
        <p>{step.explanation}</p>
        {output && (
          <div className="walkthrough-output">
            <strong>Salida</strong>
            <pre aria-label="Salida del recorrido">{output}</pre>
          </div>
        )}
      </div>
      <div className="svg-walkthrough-controls" role="group" aria-label="Controles del recorrido">
        <button type="button" aria-label="Anterior" title="Anterior" disabled={stepNumber === 1}
          onClick={() => change({ ...position, step: position.step - 1 })}>
          <Icon name="back" />
        </button>
        <button type="button" aria-label="Siguiente" title="Siguiente" disabled={stepNumber === stepCount}
          onClick={() => change({ ...position, step: position.step + 1 })}>
          <Icon name="forward" />
        </button>
        <button type="button" aria-label="Reiniciar" title="Reiniciar"
          onClick={() => change({ ...position, step: 0 })}>
          <Icon name="restart" />
        </button>
        <output aria-label="Paso del recorrido">{stepNumber} / {stepCount}</output>
      </div>
    </section>
  );
}
