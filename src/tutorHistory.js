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

function validExchange(item, courseId) {
  return (
    item &&
    typeof item.id === "string" &&
    item.courseId === courseId &&
    item.capture?.course?.id === courseId &&
    typeof item.topicId === "string" &&
    typeof item.message === "string" &&
    item.capture?.topic?.id === item.topicId &&
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
export function requestHistory(exchanges, courseId, topicId, beforeId) {
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
