import { parseWalkthroughSvg, walkthroughId } from "./walkthroughSvg.js";

const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
const text = value => typeof value === "string" && value.trim().length > 0;
const array = value => Array.isArray(value) && value.length > 0;
const validKeys = (value, keys) => record(value) && Object.keys(value).every(key => keys.includes(key));

export function validateSvgWalkthrough(walkthrough, example) {
  const requireValue = (valid, field) => {
    if (!valid) throw new Error(`Catálogo inválido: recorrido SVG, ${field}.`);
  };
  requireValue(validKeys(walkthrough, ["type", "code", "graphics", "scenarios"]), "campos desconocidos");
  requireValue(walkthrough.code === undefined || typeof walkthrough.code === "boolean", "code debe ser booleano");
  requireValue(record(walkthrough.graphics) && Object.keys(walkthrough.graphics).length > 0, "falta graphics");
  const graphics = new Map(Object.entries(walkthrough.graphics).map(([key, source]) => {
    requireValue(walkthroughId(key), `graphics.${key} inválido`);
    return [key, parseWalkthroughSvg(source).parts];
  }));
  const validLine = value => walkthrough.code === true && Number.isSafeInteger(value) && value > 0 && value <= example.split("\n").length;
  requireValue(array(walkthrough.scenarios), "falta scenarios");
  const ids = new Set();
  for (const scenario of walkthrough.scenarios) {
    requireValue(validKeys(scenario, ["id", "label", "graphic", "replacement", "steps"]) &&
      walkthroughId(scenario.id) && !ids.has(scenario.id) && text(scenario.label) &&
      graphics.has(scenario.graphic) && array(scenario.steps), "escenario inválido");
    ids.add(scenario.id);
    if (scenario.replacement !== undefined) {
      const { replacement } = scenario;
      requireValue(validKeys(replacement, ["line", "code"]) && validLine(replacement.line) &&
        text(replacement.code) && !/[\r\n]/.test(replacement.code), `${scenario.id}.replacement inválido`);
    }
    const parts = graphics.get(scenario.graphic);
    for (const [index, step] of scenario.steps.entries()) {
      const field = `${scenario.id}, paso ${index + 1}`;
      requireValue(validKeys(step, ["explanation", "line", "output", "highlight", "animate", "show", "hide"]) &&
        text(step.explanation) && (step.line === undefined || validLine(step.line)) &&
        (step.output === undefined || text(step.output)), `${field} inválido`);
      for (const key of ["highlight", "animate", "show", "hide"]) {
        const targets = step[key];
        requireValue(targets === undefined || (Array.isArray(targets) &&
          targets.every(target => parts.has(target)) && new Set(targets).size === targets.length), `${field}, ${key} inválido`);
      }
      requireValue(!step.show?.some(target => step.hide?.includes(target)), `${field}, show y hide se contradicen`);
    }
  }
  return walkthrough;
}
