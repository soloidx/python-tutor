import { assessAnswers } from "./assessment.js";

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
  if (courseProgress(course, progress).status === "Completado") return "Repasar";
  return progress.topicId ? "Continuar" : "Comenzar";
}

export function loadProgress(course) {
  try {
    const raw = localStorage.getItem(progressStorageKey(course.id));
    if (!raw) return { progress: emptyProgress(), message: "" };
    const saved = JSON.parse(raw);
    if (
      !saved ||
      !(
        saved.topicId === null ||
        (typeof saved.topicId === "string" && saved.topicId.length)
      ) ||
      !Array.isArray(saved.completed) ||
      !saved.completed.every((id) => typeof id === "string" && id.length)
    )
      throw new Error("Invalid progress");
    let assessmentResult = null;
    const questions = course.assessment?.questions || [];
    if (saved.assessmentResult !== null && saved.assessmentResult !== undefined) {
      const answers = saved.assessmentResult?.answers;
      if (
        answers &&
        questions.length &&
        questions.every((question) =>
          question.options.some((option) => option.id === answers[question.id]),
        )
      )
        assessmentResult = assessAnswers(questions, answers);
    }
    return {
      progress: {
        topicId: saved.topicId,
        completed: [...new Set(saved.completed)],
        assessmentResult,
      },
      message: "",
    };
  } catch {
    return {
      progress: emptyProgress(),
      message: "No se pudo recuperar el progreso guardado. Si el almacenamiento está bloqueado, tu avance solo estará disponible en esta sesión.",
    };
  }
}

export function saveProgress(course, progress) {
  try {
    localStorage.setItem(
      progressStorageKey(course.id),
      JSON.stringify({
        completed: progress.completed,
        topicId: progress.topicId,
        assessmentResult: progress.assessmentResult,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function removeProgress(course) {
  try {
    localStorage.removeItem(progressStorageKey(course.id));
    return true;
  } catch {
    return false;
  }
}
