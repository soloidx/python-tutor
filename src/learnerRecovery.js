import { learnerGet, learnerSet, learnerRemove, learnerList, afterLearnerCommit } from "./learnerStore.js";
// Recovery copies contain learner data only. Course-scoped prefixes let explicit
// resets include retired courses without touching catalog or tutor settings.
export const recoveryStoragePrefix = "python-tutor:recovery:v1:";
export const practiceRecoveryScope = JSON.stringify(["system", "practice"]);
export const recoveryCoursePrefix = (courseId) =>
  `${recoveryStoragePrefix}${encodeURIComponent(courseId)}:`;
export const partialRecoveryWarning =
  "Se realizó una recuperación parcial de los datos de aprendizaje. Quedó información sin recuperar; se conservó una copia de los datos originales.";
export const failedRecoveryCopyWarning =
  "Se realizó una recuperación parcial de los datos de aprendizaje. Quedó información sin recuperar y no se pudo guardar una copia. Los datos originales se conservan sin sobrescribir; los cambios solo estarán disponibles en esta sesión mientras no se pueda guardar la copia.";

// A failed copy must protect subsequent automatic saves and explicit writes,
// not just the initial repair. Keep the exact raw text until it can be backed up.
const protectedRecords = new Map();
function backupPending(key) {
  const pending = protectedRecords.get(key);
  if (!pending || pending.backedUp) return true;
  const copyKey = `${recoveryCoursePrefix(pending.courseId)}${pending.kind}:${Date.now()}:${crypto.randomUUID()}`;
  try {
    learnerSet(copyKey, pending.raw);
    pending.backedUp = true;
    return true;
  } catch { return false; }
}
export function preserveLearnerRecord(key, courseId, kind, raw, destinationKey = key) {
  const pending = protectedRecords.get(key);
  const record = pending?.raw === raw
    ? pending
    : { raw, courseId, kind, backedUp: false };
  protectedRecords.set(key, record);
  protectedRecords.set(destinationKey, record);
  if (record.backedUp) return partialRecoveryWarning;
  if (navigator.locks) navigator.locks.request("python-tutor:learner", () => backupPending(key)).catch(() => {});
  // Loading is synchronous and may overlap another tab's write. Preserve the
  // source in memory and only make a backup while holding the learner lock.
  return "Se realizó una recuperación parcial de los datos de aprendizaje. Los datos originales se conservarán sin sobrescribir hasta que pueda guardarse una copia de recuperación.";
}
export function writeLearnerRecord(key, value) {
  const pending = protectedRecords.get(key);
  if (pending && !pending.backedUp) {
    if (!backupPending(key)) return false;
  }
  try {
    learnerSet(key, value);
    return true;
  } catch {
    return false;
  }
}
export function forgetProtectedRecord(key) {
  afterLearnerCommit(() => protectedRecords.delete(key));
}
export function recoveryKeys(courseId) {
  const prefix =
    courseId === undefined
      ? recoveryStoragePrefix
      : recoveryCoursePrefix(courseId);
  return learnerList().filter((key) =>
    key.startsWith(prefix) &&
    (courseId !== undefined || !key.startsWith(recoveryCoursePrefix(practiceRecoveryScope))),
  );
}
// Returns false if any recoverable copy survives. Call only for explicit reset.
export function removeRecoveryCopies(courseId) {
  try {
    let removed = true;
    for (const key of recoveryKeys(courseId)) {
      try {
        learnerRemove(key);
      } catch {
        try {
          learnerSet(key, "");
        } catch {
          removed = false;
        }
      }
    }
    return removed;
  } catch {
    return false;
  }
}
