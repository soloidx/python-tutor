import { topics } from "./curriculum.js";
import { assessmentQuestions, assessAnswers } from "./assessment.js";

const storageKey = "python-tutor.progress.v1";
export const emptyProgress = {
  selectedRoute: null,
  view: "courses",
  topicId: topics[0].id,
  completed: [],
  assessmentResult: null,
};

export function loadProgress() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { progress: emptyProgress, message: "" };
    const saved = JSON.parse(raw);
    if (
      !saved ||
      saved.selectedRoute !== "python-fundamentos" ||
      !["courses", "learn", "assessment"].includes(saved.view) ||
      !topics.some((topic) => topic.id === saved.topicId) ||
      !Array.isArray(saved.completed) ||
      !saved.completed.every((id) =>
        topics.some((topic) =>
          topic.exercises.some((exercise) => exercise.id === id),
        ),
      )
    )
      throw new Error("Invalid progress");
    let assessmentResult = null;
    if (saved.assessmentResult !== null) {
      const answers = saved.assessmentResult?.answers;
      if (
        !answers ||
        !assessmentQuestions.every((question) =>
          question.options.includes(answers[question.id]),
        )
      ) {
        throw new Error("Invalid assessment");
      }
      // Reconstruct the result from validated answers, never trust a stored score.
      assessmentResult = assessAnswers(answers);
    }
    return {
      progress: {
        ...saved,
        completed: [...new Set(saved.completed)],
        assessmentResult,
      },
      message: "",
    };
  } catch {
    return {
      progress: emptyProgress,
      message:
        "No se pudo recuperar el progreso guardado. Empieza de nuevo; si el almacenamiento está bloqueado, tu avance solo estará disponible en esta sesión.",
    };
  }
}

export function saveProgress(progress) {
  try {
    if (!progress.selectedRoute) {
      localStorage.removeItem(storageKey);
    } else {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          ...progress,
          completedTopics: topics
            .filter((topic) =>
              topic.exercises.every((exercise) =>
                progress.completed.includes(exercise.id),
              ),
            )
            .map((topic) => topic.id),
        }),
      );
    }
    return true;
  } catch {
    return false;
  }
}

export function removeProgress() {
  try {
    localStorage.removeItem(storageKey);
    return true;
  } catch {
    return false;
  }
}
