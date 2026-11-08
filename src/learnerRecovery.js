// Recovery copies contain learner data only. Course-scoped prefixes let explicit
// resets include retired courses without touching catalog or tutor settings.
export const recoveryStoragePrefix = "python-tutor:recovery:v1:";
export const recoveryCoursePrefix = (courseId) =>
  `${recoveryStoragePrefix}${encodeURIComponent(courseId)}:`;
export const partialRecoveryWarning =
  "Se realizó una recuperación parcial de los datos de aprendizaje. Quedó información sin recuperar; se conservó una copia de los datos originales.";
export const failedRecoveryCopyWarning =
  "Se realizó una recuperación parcial de los datos de aprendizaje. Quedó información sin recuperar y no se pudo guardar una copia. Los datos originales se conservan sin sobrescribir; los cambios solo estarán disponibles en esta sesión mientras no se pueda guardar la copia.";

// A failed copy must protect subsequent automatic saves and explicit writes,
// not just the initial repair. Keep the exact raw text until it can be backed up.
const protectedRecords = new Map();
export function preserveLearnerRecord(key, courseId, kind, raw) {
  const pending = protectedRecords.get(key);
  if (pending?.raw === raw && pending.backedUp) return partialRecoveryWarning;
  const copyKey = `${recoveryCoursePrefix(courseId)}${kind}:${Date.now()}:${crypto.randomUUID()}`;
  protectedRecords.set(key, { raw, courseId, kind, backedUp: false });
  try {
    localStorage.setItem(copyKey, raw);
    protectedRecords.get(key).backedUp = true;
    return partialRecoveryWarning;
  } catch {
    return failedRecoveryCopyWarning;
  }
}
export function writeLearnerRecord(key, value) {
  const pending = protectedRecords.get(key);
  if (pending && !pending.backedUp) {
    preserveLearnerRecord(key, pending.courseId, pending.kind, pending.raw);
    if (!protectedRecords.get(key).backedUp) return false;
  }
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
export function forgetProtectedRecord(key) {
  protectedRecords.delete(key);
}
export function recoveryKeys(courseId) {
  const prefix =
    courseId === undefined
      ? recoveryStoragePrefix
      : recoveryCoursePrefix(courseId);
  return Object.keys(localStorage).filter((key) => key.startsWith(prefix));
}
// Returns false if any recoverable copy survives. Call only for explicit reset.
export function removeRecoveryCopies(courseId) {
  try {
    let removed = true;
    for (const key of recoveryKeys(courseId)) {
      try {
        localStorage.removeItem(key);
      } catch {
        try {
          localStorage.setItem(key, "");
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
