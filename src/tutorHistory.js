import {
  preserveLearnerRecord,
  writeLearnerRecord,
  forgetProtectedRecord,
} from "./learnerRecovery.js";

export const historyKeyPrefix = "python-tutor:course-conversations:v1:";
export const historyStorageKey = (courseId) =>
  historyKeyPrefix + encodeURIComponent(courseId);
export const historyStorageWarning =
  "No se pudo guardar o recuperar el historial del tutor. Puedes continuar temporalmente; los mensajes no guardados se perderán al recargar. Esto no cambia la configuración del tutor.";

const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const hasOnly = (value, keys) =>
  record(value) && Object.keys(value).every((key) => keys.includes(key));
const text = (value) => typeof value === "string";
const nonEmptyText = (value) => text(value) && value.length > 0;

function validCapture(capture, courseId, topicId) {
  if (
    !record(capture) ||
    !hasOnly(capture, [
      "course",
      "topic",
      "exercise",
      "draft",
      "lastResult",
      "selectedOptionId",
      "selectionStatus",
      "feedback",
    ])
  )
    return false;
  if (
    !record(capture.course) ||
    !hasOnly(capture.course, ["id", "title"]) ||
    capture.course.id !== courseId ||
    !nonEmptyText(capture.course.title) ||
    !record(capture.topic) ||
    !hasOnly(capture.topic, [
      "id",
      "title",
      "summary",
      "explanation",
      "example",
      "takeaway",
    ]) ||
    capture.topic.id !== topicId ||
    !nonEmptyText(capture.topic.title) ||
    !text(capture.topic.summary) ||
    !Array.isArray(capture.topic.explanation) ||
    !capture.topic.explanation.every(text) ||
    !text(capture.topic.example) ||
    !text(capture.topic.takeaway) ||
    !record(capture.exercise) ||
    !nonEmptyText(capture.exercise.id) ||
    !nonEmptyText(capture.exercise.title) ||
    !nonEmptyText(capture.exercise.prompt)
  )
    return false;

  const type = capture.exercise.type;
  if (type === undefined || type === "code") {
    if (
      !hasOnly(capture.exercise, ["id", "title", "prompt", "type"]) ||
      !hasOnly(capture, [
        "course",
        "topic",
        "exercise",
        "draft",
        "lastResult",
      ]) ||
      !text(capture.draft) ||
      !validCodeResult(capture.lastResult)
    )
      return false;
    return true;
  }
  if (type !== "choice") return false;
  if (
    !hasOnly(capture.exercise, [
      "id",
      "title",
      "prompt",
      "type",
      "code",
      "options",
    ]) ||
    (Object.hasOwn(capture.exercise, "code") &&
      !nonEmptyText(capture.exercise.code)) ||
    !Array.isArray(capture.exercise.options) ||
    capture.exercise.options.length < 2
  )
    return false;
  const optionIds = capture.exercise.options.map((option) => option?.id);
  if (
    !capture.exercise.options.every(
      (option) =>
        record(option) &&
        hasOnly(option, ["id", "text"]) &&
        nonEmptyText(option.id) &&
        nonEmptyText(option.text),
    ) ||
    new Set(optionIds).size !== optionIds.length ||
    !hasOnly(capture, [
      "course",
      "topic",
      "exercise",
      "selectedOptionId",
      "selectionStatus",
      "lastResult",
      "feedback",
    ]) ||
    !(
      capture.selectedOptionId === null ||
      optionIds.includes(capture.selectedOptionId)
    ) ||
    !["none", "pending", "checked"].includes(capture.selectionStatus) ||
    !validChoiceResult(capture.lastResult, optionIds) ||
    !(capture.feedback === null || text(capture.feedback))
  )
    return false;
  if (capture.selectionStatus === "none")
    return (
      capture.selectedOptionId === null &&
      capture.lastResult === null &&
      capture.feedback === null
    );
  if (capture.selectionStatus === "pending")
    return capture.selectedOptionId !== null && capture.feedback === null;
  return (
    capture.selectedOptionId !== null &&
    capture.lastResult?.optionId === capture.selectedOptionId &&
    nonEmptyText(capture.feedback)
  );
}

function validCodeResult(result) {
  if (result === null) return true;
  if (
    !record(result) ||
    !hasOnly(result, ["output", "error", "previous", "code"]) ||
    !text(result.output) ||
    !(result.error === null || text(result.error)) ||
    typeof result.previous !== "boolean"
  )
    return false;
  return result.previous
    ? nonEmptyText(result.code)
    : !Object.hasOwn(result, "code");
}

function validChoiceResult(result, optionIds) {
  return (
    result === null ||
    (record(result) &&
      hasOnly(result, ["optionId", "correct"]) &&
      optionIds.includes(result.optionId) &&
      typeof result.correct === "boolean")
  );
}

function validExchange(item, courseId) {
  return (
    item &&
    typeof item.id === "string" &&
    item.courseId === courseId &&
    item.capture?.course?.id === courseId &&
    typeof item.topicId === "string" &&
    typeof item.message === "string" &&
    item.capture?.topic?.id === item.topicId &&
    validCapture(item.capture, courseId, item.topicId) &&
    typeof item.capture?.exercise?.id === "string" &&
    typeof item.capture?.exercise?.title === "string" &&
    Array.isArray(item.attempts) &&
    item.attempts.length > 0 &&
    item.attempts.every(validAttempt)
  );
}

function validAttempt(attempt) {
  return (
    attempt &&
    typeof attempt.id === "string" &&
    attempt.id.length &&
    typeof attempt.text === "string" &&
    ["complete", "incomplete", "generating"].includes(attempt.status) &&
    (attempt.error === undefined ||
      attempt.error === null ||
      typeof attempt.error === "string")
  );
}

export function saveHistory(exchanges, courseId) {
  return writeLearnerRecord(
    historyStorageKey(courseId),
    JSON.stringify(exchanges.filter((item) => item.courseId === courseId)),
  )
    ? ""
    : historyStorageWarning;
}

export function storedCourseIds() {
  return Object.keys(localStorage)
    .filter((key) => key.startsWith(historyKeyPrefix))
    .flatMap((key) => {
      try {
        return [decodeURIComponent(key.slice(historyKeyPrefix.length))];
      } catch {
        return [];
      }
    });
}

export function removeHistory(courseId) {
  try {
    const ids = courseId === undefined ? storedCourseIds() : [courseId];
    let warning = "";
    for (const id of ids) {
      try {
        localStorage.removeItem(historyStorageKey(id));
        forgetProtectedRecord(historyStorageKey(id));
      } catch {
        // A browser may reject deletion while still allowing replacement.
        try {
          localStorage.setItem(historyStorageKey(id), "[]");
          forgetProtectedRecord(historyStorageKey(id));
        } catch {
          warning = historyStorageWarning;
        }
      }
    }
    return warning;
  } catch {
    return historyStorageWarning;
  }
}

export function loadHistory() {
  const exchanges = [];
  let storageWarning = "";
  const recoveryWarnings = [];
  try {
    for (const courseId of storedCourseIds()) {
      try {
        const key = historyStorageKey(courseId);
        const raw = localStorage.getItem(key);
        if (raw === null) continue;
        let stored;
        try {
          stored = JSON.parse(raw);
        } catch {
          stored = null;
        }
        let damaged = !Array.isArray(stored);
        let interrupted = false;
        const valid = [];
        for (const item of Array.isArray(stored) ? stored : []) {
          const attempts = Array.isArray(item?.attempts)
            ? item.attempts.map((attempt, index) => {
                if (validAttempt(attempt)) return attempt;
                damaged = true;
                // Keep its place: dropping a damaged final retry would promote an
                // older completed response into the confirmed request history.
                return {
                  id: `recovered-${index}`,
                  text: typeof attempt?.text === "string" ? attempt.text : "",
                  status: "incomplete",
                  errorKind: "interrupted",
                  error: "No se pudo recuperar este intento de respuesta.",
                };
              })
            : [];
          const exchange = item && { ...item, attempts };
          if (!validExchange(exchange, courseId)) {
            damaged = true;
            continue;
          }
          if (attempts.length !== item.attempts.length) damaged = true;
          valid.push({
            ...exchange,
            attempts: attempts.map((attempt) => {
              if (attempt.status !== "generating") return attempt;
              interrupted = true;
              return {
                ...attempt,
                status: "incomplete",
                errorKind: "interrupted",
                error:
                  "Respuesta interrumpida al recargar. El parcial guardado está incompleto.",
              };
            }),
          });
        }
        const counts = new Map();
        const courseExchanges = valid
          .toReversed()
          .filter((item) => {
            const count = counts.get(item.topicId) || 0;
            counts.set(item.topicId, count + 1);
            return count < 50;
          })
          .reverse();
        exchanges.push(...courseExchanges);
        if (damaged)
          recoveryWarnings.push(
            preserveLearnerRecord(key, courseId, "history", raw),
          );
        if (damaged || interrupted)
          storageWarning =
            saveHistory(courseExchanges, courseId) || storageWarning;
      } catch {
        storageWarning = historyStorageWarning;
      }
    }
  } catch {
    storageWarning = historyStorageWarning;
  }
  return {
    exchanges,
    storageWarning,
    recoveryWarning: [...new Set(recoveryWarnings)].join(" "),
  };
}

// Only the latest confirmed answer of a completed exchange can be an antecedent.
// A retry uses the original position of its question, never later exchanges.
export function requestHistory(exchanges, scope, beforeId) {
  const { courseId, topicId } = scope;
  const before = beforeId
    ? exchanges.findIndex(
        (item) =>
          item.courseId === courseId &&
          item.topicId === topicId &&
          item.id === beforeId,
      )
    : exchanges.length;
  const complete = exchanges
    .slice(0, Math.max(0, before))
    .filter(
      (item) =>
        item.courseId === courseId &&
        item.topicId === topicId &&
        item.attempts.at(-1)?.status === "complete",
    );
  return {
    omitted: Math.max(0, complete.length - 10),
    history: complete.slice(-10).map((item) => [
      {
        role: "user",
        content: JSON.stringify({
          message: item.message,
          capture: item.capture,
        }),
      },
      { role: "assistant", content: item.attempts.at(-1).text },
    ]),
  };
}
