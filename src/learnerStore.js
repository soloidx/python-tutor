// All learner records share one durable value so a complete operation becomes
// visible in a single localStorage write. Older independent records are read
// until the first successful write, which copies them into this value.
const storeKey = "python-tutor:learner-store:v1";
const learnerPrefixes = [
  "python-tutor:course-progress:v1:",
  "python-tutor:course-conversations:v1:",
  "python-tutor:recovery:v1:",
];
const learnerKeys = new Set(["python-tutor:practice:v1", "python-tutor:practice:v2"]);
const isLearnerKey = (key) => learnerKeys.has(key) || learnerPrefixes.some((prefix) => key.startsWith(prefix));
let draft = null;
let commitCallbacks = [];
let migrationSources = {};

function legacySnapshot() {
  return Object.fromEntries(Object.keys(localStorage).filter(isLearnerKey).map((key) => [key, localStorage.getItem(key)]));
}
function snapshot() {
  const raw = localStorage.getItem(storeKey);
  if (raw !== null) {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || !parsed.records || typeof parsed.records !== "object" || Array.isArray(parsed.records) || Object.values(parsed.records).some((value) => typeof value !== "string")) throw new Error("Invalid learner store");
    const expected = parsed.legacy ?? {};
    const actual = legacySnapshot();
    if (JSON.stringify(Object.entries(actual).sort()) !== JSON.stringify(Object.entries(expected).sort()))
      throw new Error("Legacy learner records changed in another version of the application");
    migrationSources = expected;
    return parsed.records;
  }
  migrationSources = legacySnapshot();
  return { ...migrationSources };
}
function commit(records) {
  // Legacy keys are deliberately retained. If an older tab changes them later,
  // snapshot refuses further writes instead of deleting or masking its data.
  if (JSON.stringify(Object.entries(legacySnapshot()).sort()) !== JSON.stringify(Object.entries(migrationSources).sort()))
    throw new Error("Legacy learner records changed during migration");
  localStorage.setItem(storeKey, JSON.stringify({ version: 1, records, legacy: migrationSources }));
}
export function learnerGet(key) {
  return (draft || snapshot())[key] ?? null;
}
export function learnerList() {
  return Object.keys(draft || snapshot());
}
export function learnerSet(key, value) {
  const records = draft || snapshot();
  records[key] = String(value);
  if (!draft) commit(records);
}
export function learnerRemove(key) {
  const records = draft || snapshot();
  delete records[key];
  if (!draft) commit(records);
}
export function afterLearnerCommit(callback) {
  if (draft) commitCallbacks.push(callback);
  else callback();
}
export function learnerTransaction(operation) {
  if (draft) throw new Error("Nested learner transaction");
  draft = snapshot();
  commitCallbacks = [];
  try {
    const result = operation();
    commit(draft);
    for (const callback of commitCallbacks) callback();
    return result;
  } finally {
    draft = null;
    commitCallbacks = [];
  }
}

// Operations that incorporate, delete, or import content can use a stable ID
// and the revision they reviewed. The marker and all changes commit together.
export function learnerRevision() {
  return JSON.stringify(snapshot());
}
export async function performLearnerOperation({ id, revision, apply }) {
  if (typeof id !== "string" || !id || typeof apply !== "function")
    throw new TypeError("Invalid learner operation");
  if (!navigator.locks) throw new Error("Learner locking unavailable");
  return navigator.locks.request("python-tutor:learner", () => {
    const marker = `python-tutor:operation:v1:${id}`;
    if (learnerGet(marker) !== null) return { status: "already-applied" };
    if (learnerRevision() !== revision) return { status: "conflict" };
    learnerTransaction(() => {
      const result = apply();
      if (result && typeof result.then === "function") throw new TypeError("Learner operations must be synchronous");
      learnerSet(marker, "complete");
    });
    return { status: "applied" };
  });
}
