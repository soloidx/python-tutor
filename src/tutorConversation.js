import { buildRequest } from "./tutorContext.js";
import {
  loadHistory,
  saveHistory,
  removeHistory,
  requestHistory,
} from "./tutorHistory.js";
import { streamTutor } from "./openRouterTutor.js";

const sameExchange = (item, scope) =>
  item.id === scope.id &&
  item.courseId === scope.courseId &&
  item.topicId === scope.topicId;

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
  let deletionWarning = "";
  const publish = (next, persist) => {
    if (next.exchanges !== state.exchanges) {
      const changedCourses = new Set(
        [...state.exchanges, ...next.exchanges]
          .filter(
            (item) => !state.exchanges.includes(item) || !next.exchanges.includes(item),
          )
          .map((item) => item.courseId),
      );
      const warning = persist
        ? persist(next.exchanges)
        : [...changedCourses]
            .map((courseId) => saveHistory(next.exchanges, courseId))
            .find(Boolean) || "";
      if (!warning) deletionWarning = "";
      next = {
        ...next,
        storageWarning: warning ? deletionWarning || warning : "",
      };
    }
    state = next;
    listeners.forEach((listener) => listener());
  };
  function update(scope, change) {
    publish({
      ...state,
      exchanges: state.exchanges.map((exchange) =>
        sameExchange(exchange, scope)
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
    const scope = state.active;
    controller?.abort();
    update(scope, {
      status: "incomplete",
      error:
        "Respuesta interrumpida. El parcial está incompleto. Cancelar el transporte no garantiza detener la facturación del proveedor.",
      errorKind: "interrupted",
    });
    publish({ ...state, active: null });
  }
  async function send({
    courseId,
    topicId,
    message,
    capture,
    config,
    exchangeId,
    onAccessIssue,
  }) {
    if (state.active || !message.trim()) return false;
    const antecedents = requestHistory(
      state.exchanges, courseId, topicId, exchangeId,
    );
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
    const scope = { id, courseId, topicId };
    const attempt = {
      id: crypto.randomUUID(),
      text: "",
      status: "generating",
      error: "",
    };
    const exchange = {
      id,
      courseId,
      topicId,
      message,
      capture: structuredClone(capture),
      attempts: [attempt],
    };
    const current = new AbortController();
    controller = current;
    const topicExchanges = state.exchanges.filter(
      (item) => item.courseId === courseId && item.topicId === topicId,
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
            sameExchange(item, scope)
              ? { ...item, attempts: [...item.attempts, attempt] }
              : item,
          )
        : [
            ...state.exchanges.filter(
              (item) => !(item.courseId === courseId &&
                item.topicId === topicId && item.id === removedId),
            ),
            exchange,
          ],
      active: scope,
      notice: notices.join(" "),
    });
    const valid = () =>
      !current.signal.aborted && controller === current && state.active === scope;
    try {
      const { finishReason } = await streamTutor({
        config,
        ...request,
        signal: current.signal,
        onText(text) {
          if (valid()) {
            const entry = state.exchanges.find((item) => sameExchange(item, scope));
            update(scope, { text: entry.attempts.at(-1).text + text });
          }
        },
      });
      if (valid())
        update(scope, {
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
        update(scope, {
          status: "incomplete",
          error: `Respuesta incompleta: ${explanation}`,
          errorKind: error.kind,
        });
        if (["key", "model"].includes(error.kind))
          onAccessIssue?.({ kind: error.kind, message: explanation });
      }
    } finally {
      current.abort();
      if (controller === current && state.active === scope)
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
    retry({ courseId, topicId, exchangeId, config, onAccessIssue }) {
      const exchange = state.exchanges.find((item) =>
        sameExchange(item, { id: exchangeId, courseId, topicId }),
      );
      if (!exchange || exchange.attempts.at(-1).status !== "incomplete")
        return false;
      return send({ ...exchange, exchangeId, config, onAccessIssue });
    },
    cancel,
    reset(courseId) {
      const active = state.active;
      if (courseId === undefined || active?.courseId === courseId) cancel();
      deletionWarning =
        "Se borraron todas las conversaciones en esta sesión, pero no se pudo borrar el historial guardado: podría reaparecer al recargar. La Configuración del tutor se conserva. Puedes seguir aprendiendo; permite el almacenamiento o borra los datos del sitio en tu navegador.";
      publish({
        ...state,
        exchanges: state.exchanges.filter(
          (item) => courseId !== undefined && item.courseId !== courseId,
        ),
        notice: "",
      }, () => removeHistory(courseId));
      return state.storageWarning;
    },
    deleteTopic(courseId, topicId) {
      const active = state.active;
      if (active?.courseId === courseId && active.topicId === topicId)
        cancel();
      const exchanges = state.exchanges.filter(
        (item) => item.courseId !== courseId || item.topicId !== topicId,
      );
      deletionWarning =
        "Se borró la conversación de este tema en esta sesión, pero no se pudo guardar el borrado: el historial borrado podría reaparecer al recargar. Los demás temas, el progreso y la Configuración del tutor se conservan. Puedes seguir aprendiendo; permite el almacenamiento o borra los datos del sitio en tu navegador.";
      publish(
        { ...state, exchanges, notice: "" },
        () => exchanges.some((item) => item.courseId === courseId)
          ? saveHistory(exchanges, courseId) : removeHistory(courseId),
      );
    },
  };
}
