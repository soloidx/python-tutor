import { originalLocalId } from "./identity.js";
import {
  preserveLearnerRecord,
  writeLearnerRecord,
  forgetProtectedRecord,
} from "./learnerRecovery.js";

// Official learner records are scoped by course and independent of navigation.
// The previous python-tutor.progress.v1 format is deliberately never imported.
export const progressStoragePrefix = "python-tutor:course-progress:v1:";
export const progressStorageKey = (courseId) =>
  `${progressStoragePrefix}${encodeURIComponent(courseId)}`;
const unreadableCourses = new Set();
export const emptyProgress = () => ({
  topicId: null,
  completed: [],
  assessmentResult: null,
});

export function courseProgress(course, progress) {
  const exercises = course.topics.flatMap((topic) => topic.exercises);
  const approved = exercises.filter((exercise) =>
    progress.completed.includes(exercise.id),
  ).length;
  const total = exercises.length;
  return {
    approved,
    total,
    percentage: Math.round((approved / total) * 100),
    status:
      approved === total
        ? "Completado"
        : approved
          ? "En progreso"
          : "Sin iniciar",
  };
}

export function resumeLabel(course, progress) {
  if (courseProgress(course, progress).status === "Completado")
    return "Repasar";
  return progress.topicId ? "Continuar" : "Comenzar";
}

export function loadProgress(course) {
  let key = progressStorageKey(course.id);
  let raw;
  try {
    raw = localStorage.getItem(key);
    const legacyId = originalLocalId(course.id);
    if (raw === null && legacyId !== null) {
      key = progressStorageKey(legacyId);
      raw = localStorage.getItem(key);
    }
    if (raw === null) return { progress: emptyProgress(), message: "" };
  } catch {
    unreadableCourses.add(course.id);
    return {
      progress: emptyProgress(),
      message:
        "No se pudo recuperar el progreso guardado. Tu avance solo estará disponible en esta sesión. Cuando se restablezca el almacenamiento, recarga para recuperar el progreso anterior.",
    };
  }
  let saved;
  try {
    saved = JSON.parse(raw);
  } catch {
    saved = null;
  }
  const record =
    saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  let damaged = record !== saved;
  const identity = (value) => typeof value === "string" && value.length > 0;
  const topicId =
    record.topicId === null || identity(record.topicId) ? record.topicId : null;
  damaged ||= !(record.topicId === null || identity(record.topicId));
  const completed = Array.isArray(record.completed)
    ? record.completed.filter(identity)
    : [];
  damaged ||=
    !Array.isArray(record.completed) ||
    completed.length !== record.completed.length;
  let assessmentResult = null;
  if (record.assessmentResult !== null) {
    const answers = record.assessmentResult?.answers;
    if (answers && typeof answers === "object" && !Array.isArray(answers)) {
      const valid = Object.entries(answers).filter(
        ([id, answer]) => identity(id) && identity(answer),
      );
      damaged ||= valid.length !== Object.keys(answers).length;
      assessmentResult = { answers: Object.fromEntries(valid) };
      // Scores/responses are a derived projection of the current publication.
      // Retain identities even when questions or the assessment are absent.
    } else damaged = true;
  }
  const progress = {
    topicId,
    completed: [...new Set(completed)],
    assessmentResult,
  };
  const message = damaged
    ? preserveLearnerRecord(key, course.id, "progress", raw)
    : "";
  if (damaged)
    writeLearnerRecord(progressStorageKey(course.id), JSON.stringify(progress));
  return { progress, message };
}

export function saveProgress(course, progress) {
  if (unreadableCourses.has(course.id)) return false;
  return writeLearnerRecord(
    progressStorageKey(course.id),
    JSON.stringify({
      completed: progress.completed,
      topicId: progress.topicId,
      assessmentResult: progress.assessmentResult,
    }),
  );
}

export function removeProgress(course) {
  const legacy = originalLocalId(course.id);
  const keys = [
    progressStorageKey(course.id),
    ...(legacy === null ? [] : [progressStorageKey(legacy)]),
  ];
  let success = true;
  for (const key of keys) {
    try {
      if (localStorage.getItem(key) === null) {
          forgetProtectedRecord(key);
          continue;
        }
      localStorage.removeItem(key);
      forgetProtectedRecord(key);
    } catch {
      try {
        localStorage.setItem(key, JSON.stringify(emptyProgress()));
        forgetProtectedRecord(key);
      } catch {
        success = false;
      }
    }
  }
  if (success) unreadableCourses.delete(course.id);
  return success;
}
