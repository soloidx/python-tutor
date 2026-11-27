// Shared publication contract: all line numbers are one-based in the topic example.
export function validateWalkthrough(value, example) {
  const fail = () => { throw new Error('Catálogo inválido: recorrido inválido.'); };
  const obj = x => x && typeof x === 'object' && !Array.isArray(x);
  const text = x => typeof x === 'string' && x.trim().length > 0;
  const id = x => typeof x === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x);
  const distinct = xs => new Set(xs).size === xs.length;
  const line = x => Number.isInteger(x) && x > 0 && x <= example.split('\n').length;
  if (obj(value) && value.type === 'collection') {
    if (!Array.isArray(value.groups) || !value.groups.length || !value.groups.every(g => obj(g) && id(g.id) && text(g.label) && Array.isArray(g.elements) && g.elements.length && g.elements.every(e => obj(e) && id(e.id) && text(e.key) && text(e.value))) || !distinct(value.groups.map(g => g.id))) fail();
    const elements = value.groups.flatMap(g => g.elements);
    if (!distinct(elements.map(e => e.id)) || !value.groups.every(g => distinct(g.elements.map(e => e.key))) || !Array.isArray(value.steps) || !value.steps.length || !value.steps.every(step => obj(step) && elements.some(e => e.id === step.element) && line(step.line) && text(step.explanation) && (step.output === undefined || text(step.output)))) fail();
    return value;
  }
  if (obj(value) && value.type === 'sequence') {
    if (!Array.isArray(value.elements) || !value.elements.length || !value.elements.every(e => obj(e) && id(e.id) && text(e.label)) || !distinct(value.elements.map(e => e.id)) || !Array.isArray(value.steps) || !value.steps.length || !value.steps.every(step => obj(step) && value.elements.some(e => e.id === step.element) && line(step.line) && text(step.explanation) && (step.output === undefined || text(step.output)))) fail();
    return value;
  }
  if (!obj(value) || value.type !== 'decision' || !Array.isArray(value.elements) || value.elements.length !== 3 || !Array.isArray(value.scenarios) || !value.scenarios.length) fail();
  if (!value.elements.every(e => obj(e) && id(e.id) && text(e.label)) || !distinct(value.elements.map(e => e.id)) || !['condition','if','else'].every(role => value.elements.some(e => e.id === role))) fail();
  if (!value.scenarios.every(s => obj(s) && id(s.id) && text(s.label) && obj(s.replacement) && line(s.replacement.line) && text(s.replacement.code) && !s.replacement.code.includes('\n') && Array.isArray(s.steps) && s.steps.length && s.steps.every(step => obj(step) && line(step.line) && value.elements.some(e => e.id === step.element) && text(step.explanation) && (step.output === undefined || text(step.output)))) || !distinct(value.scenarios.map(s => s.id))) fail();
  return value;
}
