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
let cleanupFailed = false;
export const legacyCleanupFailed = () => cleanupFailed;

function snapshot() {
  const raw = localStorage.getItem(storeKey);
  if (raw !== null) {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || !parsed.records || typeof parsed.records !== "object" || Array.isArray(parsed.records) || Object.values(parsed.records).some((value) => typeof value !== "string")) throw new Error("Invalid learner store");
    return parsed.records;
  }
  return Object.fromEntries(Object.keys(localStorage).filter(isLearnerKey).map((key) => [key, localStorage.getItem(key)]));
}
function commit(records) {
  const legacy = Object.fromEntries(Object.keys(localStorage).filter(isLearnerKey).map((key) => [key, localStorage.getItem(key)]));
  localStorage.setItem(storeKey, JSON.stringify({ version: 1, records }));
  cleanupFailed = false;
  try {
    for (const key of Object.keys(localStorage).filter(isLearnerKey)) {
      try {
        if (Object.hasOwn(legacy, key) && localStorage.getItem(key) === legacy[key]) localStorage.removeItem(key);
        else cleanupFailed = true;
      } catch { cleanupFailed = true; }
    }
  } catch { cleanupFailed = true; }
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
      apply();
      learnerSet(marker, "complete");
    });
    return { status: "applied" };
  });
}
