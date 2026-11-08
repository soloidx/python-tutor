export const historyKeyPrefix = "python-tutor:course-conversations:v1:";
const courseKey = (courseId) => historyKeyPrefix + encodeURIComponent(courseId);
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
    item.attempts.every(
      (attempt) =>
        attempt &&
        typeof attempt.id === "string" &&
        typeof attempt.text === "string" &&
        ["complete", "incomplete", "generating"].includes(attempt.status),
    )
  );
}

export function saveHistory(exchanges, courseId) {
  try {
    localStorage.setItem(courseKey(courseId), JSON.stringify(
      exchanges.filter((item) => item.courseId === courseId),
    ));
    return "";
  } catch {
    return historyStorageWarning;
  }
}

function storedCourseIds() {
  return Object.keys(localStorage)
    .filter((key) => key.startsWith(historyKeyPrefix))
    .map((key) => decodeURIComponent(key.slice(historyKeyPrefix.length)));
}

export function removeHistory(courseId) {
  try {
    const ids = courseId === undefined ? storedCourseIds() : [courseId];
    let warning = "";
    for (const id of ids) {
      try {
        localStorage.removeItem(courseKey(id));
      } catch {
        // A browser may reject deletion while still allowing replacement.
        warning = saveHistory([], id) || warning;
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
  try {
    for (const courseId of storedCourseIds()) {
      try {
        const stored = JSON.parse(localStorage.getItem(courseKey(courseId)));
        if (!Array.isArray(stored) || !stored.every((item) => validExchange(item, courseId)))
          throw new Error();
        let recovered = false;
        const counts = new Map();
        const courseExchanges = stored.toReversed().filter((item) => {
          const count = counts.get(item.topicId) || 0;
          counts.set(item.topicId, count + 1);
          return count < 50;
        }).reverse().map((exchange) => ({
          ...exchange,
          attempts: exchange.attempts.map((attempt) => {
            if (attempt.status !== "generating") return attempt;
            recovered = true;
            return {
              ...attempt,
              status: "incomplete",
              errorKind: "interrupted",
              error: "Respuesta interrumpida al recargar. El parcial guardado está incompleto.",
            };
          }),
        }));
        exchanges.push(...courseExchanges);
        if (recovered) storageWarning = saveHistory(courseExchanges, courseId) || storageWarning;
      } catch {
        storageWarning = historyStorageWarning;
      }
    }
  } catch {
    storageWarning = historyStorageWarning;
  }
  return { exchanges, storageWarning };
}

// Only the latest confirmed answer of a completed exchange can be an antecedent.
// A retry uses the original position of its question, never later exchanges.
export function requestHistory(exchanges, courseId, topicId, beforeId) {
  const before = beforeId
    ? exchanges.findIndex((item) => item.courseId === courseId && item.topicId === topicId && item.id === beforeId)
    : exchanges.length;
  const complete = exchanges
    .slice(0, Math.max(0, before))
    .filter(
      (item) =>
        item.courseId === courseId && item.topicId === topicId && item.attempts.at(-1)?.status === "complete",
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
