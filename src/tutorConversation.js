import { buildRequest } from "./tutorContext.js";
import { loadHistory, saveHistory, requestHistory } from "./tutorHistory.js";
import { streamTutor } from "./openRouterTutor.js";

export function createConversationService() {
  let state = { ...loadHistory(), active: null, notice: "" };
  let controller = null;
  const listeners = new Set();
  const publish = (next) => {
    if (next.exchanges !== state.exchanges) {
      next = { ...next, storageWarning: saveHistory(next.exchanges) };
    }
    state = next;
    listeners.forEach((listener) => listener());
  };
  function update(id, change) {
    publish({
      ...state,
      exchanges: state.exchanges.map((exchange) =>
        exchange.id === id
          ? {
              ...exchange,
              attempts: exchange.attempts.map((attempt, index) =>
                index === exchange.attempts.length - 1
                  ? { ...attempt, ...change }
                  : attempt,
              ),
            }
          : exchange,
      ),
    });
  }
  function cancel() {
    if (!state.active) return;
    const id = state.active;
    controller?.abort();
    update(id, {
      status: "incomplete",
      error: "Respuesta interrumpida. El parcial está incompleto.",
    });
    publish({ ...state, active: null });
  }
  async function send({ topicId, message, capture, config }) {
    if (state.active || !message.trim()) return false;
    const antecedents = requestHistory(state.exchanges, topicId);
    let request;
    try {
      request = buildRequest({
        capture,
        message,
        model: config.model,
        history: antecedents.history,
      });
    } catch (error) {
      publish({ ...state, notice: error.message });
      return false;
    }
    const id = crypto.randomUUID();
    const attempt = {
      id: crypto.randomUUID(),
      text: "",
      status: "generating",
      error: "",
    };
    const exchange = {
      id,
      topicId,
      message,
      capture: structuredClone(capture),
      attempts: [attempt],
    };
    const current = new AbortController();
    controller = current;
    const topicExchanges = state.exchanges.filter(
      (item) => item.topicId === topicId,
    );
    const removedId = topicExchanges.length >= 50 ? topicExchanges[0].id : null;
    const notices = [];
    if (removedId)
      notices.push(
        "Se eliminó el intercambio más antiguo de este tema: el historial local conserva hasta 50 intercambios, incluidos los incompletos.",
      );
    if (antecedents.omitted)
      notices.push(
        "Se omitieron antecedentes antiguos del envío: se incluyen como máximo los diez intercambios completos más recientes.",
      );
    if (request.omitted)
      notices.push(
        "Se omitieron antecedentes antiguos por capacidad del modelo, sin resumir ni recortar su contenido.",
      );
    publish({
      ...state,
      exchanges: [
        ...state.exchanges.filter((item) => item.id !== removedId),
        exchange,
      ],
      active: id,
      notice: notices.join(" "),
    });
    const valid = () => !current.signal.aborted && state.active === id;
    try {
      const { finishReason } = await streamTutor({
        config,
        ...request,
        signal: current.signal,
        onText(text) {
          if (valid()) {
            const entry = state.exchanges.find((item) => item.id === id);
            update(id, { text: entry.attempts.at(-1).text + text });
          }
        },
      });
      if (valid())
        update(id, {
          status: finishReason === "stop" ? "complete" : "incomplete",
          error:
            finishReason === "stop"
              ? ""
              : "Respuesta incompleta: no se confirmó una terminación normal.",
        });
    } catch (error) {
      if (valid())
        update(id, {
          status: "incomplete",
          error:
            "No se pudo completar la respuesta. Comprueba la conexión y el acceso del tutor.",
        });
    } finally {
      current.abort();
      if (state.active === id) publish({ ...state, active: null });
    }
    return true;
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    send,
    cancel,
  };
}
