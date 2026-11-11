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

// Review a mismatch without attempting to use or replace either version.
export function inspectLegacyConflict() {
  try {
    const raw = localStorage.getItem(storeKey);
    if (raw === null) return null;
    const stored = JSON.parse(raw);
    if (!stored || stored.version !== 1 || !stored.records || typeof stored.records !== "object" || Array.isArray(stored.records)) return null;
    const before = stored.legacy ?? {};
    const after = legacySnapshot();
    if (JSON.stringify(Object.entries(before).sort()) === JSON.stringify(Object.entries(after).sort())) return null;
    return { raw, before, after, records: stored.records };
  } catch { return null; }
}

// Keep the current store as the active version and retain both sides of every
// changed legacy record as recovery data in the same durable write.
export async function preserveLegacyConflict(reviewed, readSession, useLegacy = false) {
  if (!navigator.locks) throw new Error("Learner locking unavailable");
  return navigator.locks.request("python-tutor:learner", () => {
    const current = inspectLegacyConflict();
    if (!current || current.raw !== reviewed.raw || JSON.stringify(Object.entries(current.after).sort()) !== JSON.stringify(Object.entries(reviewed.after).sort()))
      return "conflict";
    const stored = JSON.parse(current.raw);
    const keys = new Set([...Object.keys(current.before), ...Object.keys(current.after)]);
    if (useLegacy) {
      const copy = `python-tutor:recovery:v1:${encodeURIComponent(JSON.stringify(["system", "legacy-reconciliation"]))}:legacy:${crypto.randomUUID()}`;
      const activeRecords = Object.fromEntries(Object.entries(stored.records).filter(([key]) => !key.startsWith("python-tutor:recovery:v1:")));
      stored.records[copy] = JSON.stringify({ type: "current", records: activeRecords });
    }
    for (const key of keys) {
      const before = current.before[key] ?? null;
      const after = current.after[key] ?? null;
      if (before === after) continue;
      const copy = `python-tutor:recovery:v1:${encodeURIComponent(JSON.stringify(["system", "legacy-reconciliation"]))}:legacy:${crypto.randomUUID()}`;
      stored.records[copy] = JSON.stringify({ key, before, after });
      if (!useLegacy) continue;
      const coursePrefix = ["python-tutor:course-progress:v1:", "python-tutor:course-conversations:v1:"].find((prefix) => key.startsWith(prefix));
      if (coursePrefix) {
        const id = decodeURIComponent(key.slice(coursePrefix.length));
        let internal;
        try { internal = JSON.parse(id); } catch { internal = null; }
        const canonical = Array.isArray(internal) && internal.length === 2
          ? key
          : coursePrefix + encodeURIComponent(JSON.stringify(["original", id]));
        delete stored.records[canonical];
        if (after === null) delete stored.records[key];
        else stored.records[key] = after;
      } else if (key === "python-tutor:practice:v1" || key === "python-tutor:practice:v2") {
        if (key.endsWith(":v1")) delete stored.records["python-tutor:practice:v2"];
        if (after === null) delete stored.records[key];
        else stored.records[key] = after;
      }
    }
    const session = readSession?.();
    if (session) {
      const copy = `python-tutor:recovery:v1:${encodeURIComponent(JSON.stringify(["system", "legacy-reconciliation"]))}:legacy:${crypto.randomUUID()}`;
      stored.records[copy] = JSON.stringify({ type: "session", data: session });
    }
    stored.legacy = current.after;
    localStorage.setItem(storeKey, JSON.stringify(stored));
    return "preserved";
  });
}

export function readLegacyRecoveries() {
  try {
    const prefix = `python-tutor:recovery:v1:${encodeURIComponent(JSON.stringify(["system", "legacy-reconciliation"]))}:legacy:`;
    return Object.entries(snapshot())
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, raw]) => ({ key, raw }));
  } catch { return []; }
}
