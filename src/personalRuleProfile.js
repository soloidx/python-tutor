// Personal exercise checks are data. The student's program never receives them.
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const fields = (value, expected) => record(value) && Object.keys(value).length === expected.length && expected.every((key) => Object.hasOwn(value, key));
const scalar = (value) => typeof value === "boolean" || (typeof value === "string" && value.length <= 20000) || (typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER);
const name = (value) => typeof value === "string" && value.length <= 64 && /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);

export function validateRules(rules) {
  if (!Array.isArray(rules) || rules.length < 1 || rules.length > 20) throw new Error("Reglas fuera del perfil.");
  for (const rule of rules) {
    if (rule?.kind === "stdout" && fields(rule, ["kind", "equals"]) && typeof rule.equals === "string" && rule.equals.length <= 20000) continue;
    if (rule?.kind === "variable" && fields(rule, ["kind", "name", "equals"]) && name(rule.name) && scalar(rule.equals)) continue;
    throw new Error("Regla fuera del perfil.");
  }
  return rules;
}

export function compareObservations(rules, observations) {
  validateRules(rules);
  if (!fields(observations, ["output", "variables"]) || typeof observations.output !== "string" || observations.output.length > 20000 || !record(observations.variables)) throw new Error("Observaciones fuera del perfil.");
  const names = [...new Set(rules.filter((rule) => rule.kind === "variable").map((rule) => rule.name))];
  if (!fields(observations.variables, names)) throw new Error("Observaciones incompletas.");
  for (const entry of Object.values(observations.variables)) {
    if (!fields(entry, ["type", "value"]) || !scalar(entry.value) || entry.type !== typeof entry.value) throw new Error("Valor observado fuera del perfil.");
  }
  return rules.every((rule) => {
    const actual = rule.kind === "stdout" ? observations.output.trimEnd() : observations.variables[rule.name].value;
    const expected = rule.kind === "stdout" ? rule.equals.trimEnd() : rule.equals;
    return typeof actual === typeof expected && actual === expected;
  });
}
