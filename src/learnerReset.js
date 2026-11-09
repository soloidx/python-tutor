import { emptyProgress, removeProgress, progressStoragePrefix } from "./progress.js";
import { removeRecoveryCopies } from "./learnerRecovery.js";

const progressRemovalWarning =
  "No se pudo borrar el progreso guardado. Se reinició esta sesión, pero el progreso anterior podría reaparecer al recargar. Permite el almacenamiento o borra los datos del sitio en tu navegador.";
const recoveryRemovalWarning =
  "No se pudieron borrar todas las copias de recuperación; los datos anteriores podrían seguir guardados. Borra los datos del sitio en tu navegador.";
const enumerationWarning =
  "No se pudo comprobar todo el almacenamiento. Podrían quedar datos de cursos retirados; borra los datos del sitio en tu navegador para completar el reinicio global.";

// Clears all learner records for one course or every course, including retired
// course IDs found in storage. Returns only the active courses that need UI state.
export function resetLearner({ all, courseId, progressByCourse, courses, conversation }) {
  const historyWarning = conversation.reset(all ? undefined : courseId);
  const ids = new Set(all ? Object.keys(progressByCourse) : [courseId]);
  let enumerationFailed = false;

  if (all) {
    try {
      for (const key of Object.keys(localStorage)) {
        if (!key.startsWith(progressStoragePrefix)) continue;
        try {
          ids.add(decodeURIComponent(key.slice(progressStoragePrefix.length)));
        } catch {
          enumerationFailed = true;
        }
      }
    } catch {
      enumerationFailed = true;
    }
  }

  let progressFailed = false;
  const cleared = {};
  for (const id of ids) {
    const removed = removeProgress({ id });
    progressFailed ||= !removed;
    if (courses[id]) cleared[id] = { progress: emptyProgress(), message: "" };
  }

  const copiesRemoved = removeRecoveryCopies(all ? undefined : courseId);
  const warnings = [
    progressFailed ? progressRemovalWarning : "",
    historyWarning,
    !copiesRemoved ? recoveryRemovalWarning : "",
    enumerationFailed ? enumerationWarning : "",
  ].filter(Boolean);

  return { cleared, warning: warnings.join(" ") };
}
