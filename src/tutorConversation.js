import { buildRequest } from "./tutorContext.js";
import { streamTutor } from "./openRouterTutor.js";

export function createConversationService() {
  let state = { exchanges: [], active: null, notice: "" };
  let controller = null;
  const listeners = new Set();
  const publish = (next) => {
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
    let request;
    try {
      request = buildRequest({ capture, message, model: config.model });
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
    publish({
      ...state,
      exchanges: [...state.exchanges, exchange],
      active: id,
      notice: "",
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
