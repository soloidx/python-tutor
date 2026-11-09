import { createPracticeRound } from "./practiceRound.js";

// Practice owns one record, independent of course progress and conversations.
export const practiceStorageKey = "python-tutor:practice:v1";
const identity = (value) => typeof value === "string" && value.length > 0;
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value);
const optional = (value, valid) => value === undefined || valid(value);
const nullableText = (value) => value === null || typeof value === "string";
const text = (value) => typeof value === "string";
const resultValid = (value) =>
  value === null ||
  (object(value) &&
    typeof value.passed === "boolean" &&
    text(value.output) &&
    nullableText(value.error));

// Only displayed metadata belongs in the review snapshot. Executable authored
// content is always resolved from the activated publication, never this record.
function snapshotEntry({ course, topic, exercise }) {
  return {
    course: { id: course.id, title: course.title },
    topic: {
      id: topic.id,
      title: topic.title,
      summary: topic.summary,
      explanation: [...topic.explanation],
      example: topic.example,
      takeaway: topic.takeaway,
    },
    exercise: {
      id: exercise.id,
      type: exercise.type === "choice" ? "choice" : "code",
      title: exercise.title,
      prompt: exercise.prompt,
      ...(exercise.type === "choice"
        ? {
            code: exercise.code || "",
            options: exercise.options.map(({ id, text }) => ({ id, text })),
          }
        : { starter: exercise.starter || "" }),
    },
  };
}

function projectResult(result) {
  return result == null
    ? null
    : {
        passed: result.passed,
        output: result.output || "",
        error: result.error || null,
      };
}

function projectWork(work) {
  return {
    ...(work.code !== undefined ? { code: work.code } : {}),
    hintCount: work.hintCount ?? 0,
    result: projectResult(work.result),
    feedback: work.feedback ?? "",
    lastCodeResult: work.lastCodeResult
      ? {
          exerciseId: work.lastCodeResult.exerciseId,
          code: work.lastCodeResult.code,
          output: work.lastCodeResult.output,
          error: work.lastCodeResult.error,
        }
      : null,
    selectedOptionId: work.selectedOptionId ?? null,
    selectionStatus: work.selectionStatus ?? "none",
    selectionResult: work.selectionResult
      ? {
          optionId: work.selectionResult.optionId,
          correct: work.selectionResult.correct,
        }
      : null,
    selectionFeedback: work.selectionFeedback ?? null,
  };
}

function validSnapshot(snapshot, entry) {
  if (!object(snapshot)) return false;
  const { course, topic, exercise } = snapshot;
  if (
    ![course, topic, exercise].every(object) ||
    course.id !== entry.courseId ||
    topic.id !== entry.topicId ||
    exercise.id !== entry.id ||
    ![
      course.title,
      topic.title,
      topic.summary,
      topic.example,
      topic.takeaway,
      exercise.title,
      exercise.prompt,
    ].every(text) ||
    !Array.isArray(topic.explanation) ||
    !topic.explanation.every(text)
  )
    return false;
  if (exercise.type === "code") return text(exercise.starter);
  return (
    exercise.type === "choice" &&
    text(exercise.code) &&
    Array.isArray(exercise.options) &&
    exercise.options.length > 0 &&
    exercise.options.every(
      (option) => object(option) && identity(option.id) && text(option.text),
    ) &&
    new Set(exercise.options.map((option) => option.id)).size ===
      exercise.options.length
  );
}

function validWork(work, entry) {
  if (
    !object(work) ||
    !optional(work.code, text) ||
    !Number.isInteger(work.hintCount) ||
    work.hintCount < 0 ||
    !resultValid(work.result) ||
    !text(work.feedback) ||
    !nullableText(work.selectedOptionId) ||
    !nullableText(work.selectionFeedback) ||
    !["none", "pending", "checked"].includes(work.selectionStatus)
  )
    return false;
  const last = work.lastCodeResult;
  if (
    last !== null &&
    (!object(last) ||
      last.exerciseId !== entry.id ||
      !text(last.code) ||
      !text(last.output) ||
      !nullableText(last.error))
  )
    return false;
  const selection = work.selectionResult;
  if (
    selection !== null &&
    (!object(selection) ||
      !identity(selection.optionId) ||
      typeof selection.correct !== "boolean")
  )
    return false;
  if (entry.snapshot.exercise.type === "choice") {
    const ids = entry.snapshot.exercise.options.map((option) => option.id);
    if (work.selectedOptionId !== null && !ids.includes(work.selectedOptionId))
      return false;
    if (selection && !ids.includes(selection.optionId)) return false;
  }
  return work.selectionStatus !== "checked" || selection !== null;
}

export function loadPractice(publication) {
  let raw;
  try {
    raw = localStorage.getItem(practiceStorageKey);
  } catch {
    return { round: null, notice: null, storageAvailable: false };
  }
  const damaged = () => ({
    round: createPracticeRound(publication),
    notice:
      "No pudimos recuperar la ronda guardada porque el registro está dañado. Comenzamos una ronda nueva con los ejercicios disponibles.",
    storageAvailable: true,
  });
  if (raw === null)
    return { round: null, notice: null, storageAvailable: true };
  try {
    const saved = JSON.parse(raw);
    if (
      !object(saved) ||
      saved.version !== 1 ||
      !identity(saved.id) ||
      !identity(saved.revision) ||
      !Array.isArray(saved.entries) ||
      typeof saved.reviewing !== "boolean"
    )
      return damaged();
    const ids = saved.entries.map((entry) => entry?.id);
    if (
      !ids.every(identity) ||
      new Set(ids).size !== ids.length ||
      (ids.length ? !ids.includes(saved.currentId) : saved.currentId !== null)
    )
      return damaged();
    const complete =
      saved.entries.length > 0 &&
      saved.entries.every((entry) => entry.status === "resolved");
    if (saved.reviewing && !complete) return damaged();
    // Validate the whole record before using any snapshot or live reference.
    for (const entry of saved.entries) {
      if (
        !identity(entry.courseId) ||
        !identity(entry.topicId) ||
        !["pending", "in-progress", "resolved"].includes(entry.status) ||
        !validSnapshot(entry.snapshot, entry) ||
        !validWork(entry.work, entry)
      )
        return damaged();
    }
    const changed = saved.revision !== publication.catalog.revision;
    if (changed && !complete)
      return {
        round: createPracticeRound(publication),
        notice:
          "El catálogo cambió. Sustituimos tu ronda incompleta por una nueva, sin trasladar sus respuestas ni su progreso.",
        storageAvailable: true,
      };
    const archived = changed && complete;
    const entries = [];
    for (const entry of saved.entries) {
      const snapshot = snapshotEntry(entry.snapshot);
      const course = publication.courses[entry.courseId];
      const topic = course?.topics.find((item) => item.id === entry.topicId);
      const exercise = topic?.exercises.find((item) => item.id === entry.id);
      if (!archived && !exercise) return damaged();
      entries.push({
        id: entry.id,
        course: archived ? snapshot.course : course,
        topic: archived ? snapshot.topic : topic,
        exercise: archived ? snapshot.exercise : exercise,
        status: entry.status,
        work: projectWork(entry.work),
        snapshot,
      });
    }
    return {
      round: {
        archived,
        id: saved.id,
        revision: saved.revision,
        currentId: saved.currentId,
        reviewing: saved.reviewing,
        entries,
      },
      notice: null,
      storageAvailable: true,
    };
  } catch {
    return damaged();
  }
}

export function savePractice(round) {
  try {
    localStorage.setItem(
      practiceStorageKey,
      JSON.stringify({
        version: 1,
        id: round.id,
        revision: round.revision,
        currentId: round.currentId,
        reviewing: round.reviewing,
        entries: round.entries.map((entry) => ({
          id: entry.id,
          courseId: entry.course.id,
          topicId: entry.topic.id,
          status: entry.status,
          snapshot: snapshotEntry(entry.snapshot ?? entry),
          work: projectWork(entry.work),
        })),
      }),
    );
    return true;
  } catch {
    return false;
  }
}
