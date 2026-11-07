import { buildRequest } from "./tutorContext.js";
import { loadHistory, saveHistory, requestHistory } from "./tutorHistory.js";
import { streamTutor } from "./openRouterTutor.js";

const recovery = {
  key: "OpenRouter rechazó la clave. Corrígela en Configuración del tutor.",
  balance:
    "OpenRouter indica saldo insuficiente. Revisa tu saldo y facturación en OpenRouter antes de reintentar.",
  model:
    "El modelo ya no está disponible o no es compatible. Selecciona otro modelo explícitamente en Configuración del tutor.",
  context:
    "OpenRouter rechazó la capacidad de contexto pese a la estimación. No se recortó ni reenvió nada. Reduce el mensaje o borrador en un mensaje nuevo, o selecciona un modelo con mayor ventana.",
  rate: "OpenRouter alcanzó el límite de solicitudes. Espera y reintenta explícitamente.",
  timeout:
    "Se alcanzó el límite temporal de la respuesta. Puedes reintentar explícitamente.",
  service:
    "El servicio de OpenRouter no está disponible. Puedes reintentar explícitamente en unos momentos.",
  network:
    "Se perdió la conexión de red. Revisa tu conexión y reintenta explícitamente.",
  rejected:
    "El servicio rechazó la solicitud. Revisa el acceso y el modelo en Configuración del tutor antes de reintentar.",
};

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
      error:
        "Respuesta interrumpida. El parcial está incompleto. Cancelar el transporte no garantiza detener la facturación del proveedor.",
      errorKind: "interrupted",
    });
    publish({ ...state, active: null });
  }
  async function send({
    topicId,
    message,
    capture,
    config,
    exchangeId,
    onAccessIssue,
  }) {
    if (state.active || !message.trim()) return false;
    const antecedents = requestHistory(state.exchanges, topicId, exchangeId);
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
    const id = exchangeId || crypto.randomUUID();
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
    const removedId =
      !exchangeId && topicExchanges.length >= 50 ? topicExchanges[0].id : null;
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
      exchanges: exchangeId
        ? state.exchanges.map((item) =>
            item.id === id
              ? { ...item, attempts: [...item.attempts, attempt] }
              : item,
          )
        : [
            ...state.exchanges.filter((item) => item.id !== removedId),
            exchange,
          ],
      active: id,
      notice: notices.join(" "),
    });
    const valid = () =>
      !current.signal.aborted && controller === current && state.active === id;
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
          errorKind:
            finishReason === "stop"
              ? ""
              : finishReason === "length"
                ? "output"
                : "unconfirmed",
          error:
            finishReason === "stop"
              ? ""
              : finishReason === "length"
                ? "Respuesta incompleta: se alcanzó el límite de salida. Puedes reintentar con la captura original; no se continúa automáticamente."
                : "Respuesta incompleta: no se confirmó una terminación normal.",
        });
    } catch (error) {
      if (valid()) {
        const explanation = recovery[error.kind] || recovery.service;
        update(id, {
          status: "incomplete",
          error: `Respuesta incompleta: ${explanation}`,
          errorKind: error.kind,
        });
        if (["key", "model"].includes(error.kind))
          onAccessIssue?.({ kind: error.kind, message: explanation });
      }
    } finally {
      current.abort();
      if (controller === current && state.active === id)
        publish({ ...state, active: null });
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
    retry({ exchangeId, config, onAccessIssue }) {
      const exchange = state.exchanges.find((item) => item.id === exchangeId);
      if (!exchange || exchange.attempts.at(-1).status !== "incomplete")
        return false;
      return send({ ...exchange, exchangeId, config, onAccessIssue });
    },
    cancel,
  };
}
