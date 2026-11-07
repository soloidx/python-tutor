const key = "python-tutor:conversations:v1";
export const historyStorageWarning =
  "No se pudo guardar o recuperar el historial del tutor. Puedes continuar temporalmente; los mensajes no guardados se perderán al recargar. Esto no cambia la configuración del tutor.";

function validExchange(item) {
  return (
    item &&
    typeof item.id === "string" &&
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

export function saveHistory(exchanges) {
  try {
    localStorage.setItem(key, JSON.stringify(exchanges));
    return "";
  } catch {
    return historyStorageWarning;
  }
}

export function loadHistory() {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { exchanges: [], storageWarning: "" };
    const stored = JSON.parse(raw);
    if (!Array.isArray(stored) || !stored.every(validExchange))
      throw new Error();
    let recovered = false;
    const counts = new Map();
    const exchanges = stored
      .toReversed()
      .filter((item) => {
        const count = counts.get(item.topicId) || 0;
        counts.set(item.topicId, count + 1);
        return count < 50;
      })
      .reverse()
      .map((exchange) => ({
        ...exchange,
        attempts: exchange.attempts.map((attempt) => {
          if (attempt.status !== "generating") return attempt;
          recovered = true;
          return {
            ...attempt,
            status: "incomplete",
            errorKind: "interrupted",
            error:
              "Respuesta interrumpida al recargar. El parcial guardado está incompleto.",
          };
        }),
      }));
    return {
      exchanges,
      storageWarning: recovered ? saveHistory(exchanges) : "",
    };
  } catch {
    return { exchanges: [], storageWarning: historyStorageWarning };
  }
}

// Only the latest confirmed answer of a completed exchange can be an antecedent.
// A retry uses the original position of its question, never later exchanges.
export function requestHistory(exchanges, topicId, beforeId) {
  const before = beforeId
    ? exchanges.findIndex((item) => item.id === beforeId)
    : exchanges.length;
  const complete = exchanges
    .slice(0, Math.max(0, before))
    .filter(
      (item) =>
        item.topicId === topicId && item.attempts.at(-1)?.status === "complete",
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
