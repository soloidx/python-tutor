// Shared publication contract: all line numbers are one-based in the topic example.
export function validateWalkthrough(value, example) {
  const fail = () => { throw new Error('Catálogo inválido: recorrido inválido.'); };
  const obj = x => x && typeof x === 'object' && !Array.isArray(x);
  const text = x => typeof x === 'string' && x.trim().length > 0;
  const id = x => typeof x === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x);
  const distinct = xs => new Set(xs).size === xs.length;
  const line = x => Number.isInteger(x) && x > 0 && x <= example.split('\n').length;
  if (!obj(value) || value.type !== 'decision' || !Array.isArray(value.elements) || value.elements.length !== 3 || !Array.isArray(value.scenarios) || !value.scenarios.length) fail();
  if (!value.elements.every(e => obj(e) && id(e.id) && text(e.label)) || !distinct(value.elements.map(e => e.id)) || !['condition','if','else'].every(role => value.elements.some(e => e.id === role))) fail();
  if (!value.scenarios.every(s => obj(s) && id(s.id) && text(s.label) && obj(s.replacement) && line(s.replacement.line) && text(s.replacement.code) && !s.replacement.code.includes('\n') && Array.isArray(s.steps) && s.steps.length && s.steps.every(step => obj(step) && line(step.line) && value.elements.some(e => e.id === step.element) && text(step.explanation) && (step.output === undefined || text(step.output)))) || !distinct(value.scenarios.map(s => s.id))) fail();
  return value;
}
