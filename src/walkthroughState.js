export function visibleWalkthrough(walkthrough, example, position = { scenario: 0, step: 0 }) {
  const scenario = walkthrough.type === 'decision' ? walkthrough.scenarios[position.scenario] : { steps: walkthrough.steps };
  const step = scenario.steps[position.step];
  const element = walkthrough.type === 'collection'
    ? walkthrough.groups.flatMap(group => group.elements).find(item => item.id === step.element)
    : walkthrough.elements.find(item => item.id === step.element);
  const lines = example.split('\n');
  if (scenario.replacement) lines[scenario.replacement.line - 1] = scenario.replacement.code;
  return {
    type: walkthrough.type,
    scenario: walkthrough.type === 'decision' ? { id: scenario.id, label: scenario.label } : null,
    step: { line: step.line, element: step.element, explanation: step.explanation, ...(step.output === undefined ? {} : { output: step.output }) },
    element: walkthrough.type === 'collection' ? { id: element.id, key: element.key, value: element.value } : { id: element.id, label: element.label },
    stepNumber: position.step + 1,
    stepCount: scenario.steps.length,
    code: lines.join('\n'),
    output: scenario.steps.slice(0, position.step + 1).flatMap(item => item.output ? [item.output] : []).join('\n'),
  };
}
