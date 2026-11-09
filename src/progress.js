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
  const key = progressStorageKey(course.id);
  let raw;
  try {
    raw = localStorage.getItem(key);
    if (raw === null) return { progress: emptyProgress(), message: "" };
  } catch {
    return {
      progress: emptyProgress(),
      message:
        "No se pudo recuperar el progreso guardado. Si el almacenamiento está bloqueado, tu avance solo estará disponible en esta sesión.",
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
  if (damaged) writeLearnerRecord(key, JSON.stringify(progress));
  return { progress, message };
}

export function saveProgress(course, progress) {
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
  try {
    localStorage.removeItem(progressStorageKey(course.id));
    forgetProtectedRecord(progressStorageKey(course.id));
    return true;
  } catch {
    try {
      // Explicit reset may discard even a protected damaged original.
      localStorage.setItem(
        progressStorageKey(course.id),
        JSON.stringify(emptyProgress()),
      );
      forgetProtectedRecord(progressStorageKey(course.id));
      return true;
    } catch {
      return false;
    }
  }
}
