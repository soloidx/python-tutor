import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { checkAccess, modelIncompatibility } from "./openRouterAccess.js";

export function TutorPanel({
  onConfigure,
  access,
  conversation,
  topicId,
  capture,
}) {
  const state = useSyncExternalStore(
    conversation.subscribe,
    conversation.getSnapshot,
  );
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState("");
  const busy = !!state.active;
  async function send() {
    if (!ready || busy || !message.trim()) return;
    const pending = conversation.send({
      topicId,
      message,
      capture: capture(),
      config: access.config,
      onAccessIssue: access.reportIssue,
    });
    if (!conversation.getSnapshot().notice) setMessage("");
    await pending;
  }
  const ready = access.status === "ready";
  const checking = access.status === "checking";
  return (
    <div className="tutor-panel">
      <div className="panel-heading">
        <h2>Tutor</h2>
        <button
          className="secondary"
          onClick={onConfigure}
          aria-label="Configuración del tutor"
        >
          Configuración
        </button>
      </div>
      <div className="lesson-content" aria-live="polite">
        <h3>Aprende con ayuda, a tu ritmo</h3>
        {checking ? (
          <p>Comprobando acceso…</p>
        ) : ready ? (
          <p>Acceso listo · {access.config.model.name}</p>
        ) : (
          <>
            <p>
              {access.message ||
                "Configura una clave validada de OpenRouter y selecciona un modelo compatible para habilitar el tutor. Puedes seguir leyendo y practicando sin configurar acceso."}
            </p>
            <button className="primary" onClick={onConfigure}>
              Configurar tutor
            </button>
            {["network", "service"].includes(access.status) && (
              <button className="secondary" onClick={access.recheck}>
                Reintentar comprobación
              </button>
            )}
          </>
        )}
        {access.sessionOnly && (
          <p className="storage-warning">
            Solo en esta sesión. La configuración se perderá al recargar.
          </p>
        )}
        <div className="tutor-conversation" aria-label="Conversación de tema">
          {state.exchanges
            .filter((item) => item.topicId === topicId)
            .map((exchange) => (
              <article key={exchange.id} className="tutor-exchange">
                <p>
                  <strong>{exchange.capture.exercise.title}</strong>
                </p>
                <p className="tutor-question">{exchange.message}</p>
                {exchange.attempts.map((attempt) => (
                  <div key={attempt.id}>
                    <p className="tutor-answer">{attempt.text}</p>
                    {Array.from(
                      attempt.text.matchAll(
                        /```(?:[a-zA-Z]+)?\n([\s\S]*?)```/g,
                      ),
                    ).map((match, index) => (
                      <div key={index}>
                        <pre>
                          <code>{match[1]}</code>
                        </pre>
                        <button
                          className="secondary"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(match[1]);
                              setCopied("Código copiado");
                            } catch {
                              setCopied(
                                "No se pudo copiar el código. Selecciónalo y cópialo manualmente.",
                              );
                            }
                          }}
                        >
                          Copiar código
                        </button>
                      </div>
                    ))}
                    <p>
                      {attempt.status === "complete"
                        ? "Respuesta completa"
                        : attempt.status === "generating"
                          ? "Generando…"
                          : attempt.error}
                    </p>
                  </div>
                ))}
                {exchange.attempts.at(-1).status !== "complete" && (
                  <button
                    className="secondary"
                    disabled={!ready || busy}
                    onClick={() =>
                      conversation.retry({
                        exchangeId: exchange.id,
                        config: access.config,
                        onAccessIssue: access.reportIssue,
                      })
                    }
                  >
                    Reintentar respuesta
                  </button>
                )}
              </article>
            ))}
        </div>
        {copied && <p>{copied}</p>}
        {state.notice && <p role="alert">{state.notice}</p>}
        <label className="tutor-message">
          Mensaje al tutor
          <textarea
            disabled={!ready}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                send();
              }
            }}
          />
        </label>
        <button className="primary" disabled={!ready || busy} onClick={send}>
          Enviar
        </button>
        {busy && (
          <button className="secondary" onClick={conversation.cancel}>
            Detener
          </button>
        )}
      </div>
    </div>
  );
}

export function TutorSettings({ access, onClose, onSaved }) {
  const dialog = useRef(null);
  const abort = useRef(null);
  const [key, setKey] = useState(access.config?.key || "");
  const [selected, setSelected] = useState(access.config?.model || null);
  const [models, setModels] = useState([]);
  const [validatedKey, setValidatedKey] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [storageFailed, setStorageFailed] = useState(false);
  const [pending, setPending] = useState(null);
  useEffect(() => {
    const opener = document.activeElement;
    dialog.current.showModal();
    dialog.current.querySelector("input").focus();
    return () => {
      abort.current?.abort();
      opener?.focus();
    };
  }, []);

  async function validate(saving = false) {
    const controller = new AbortController();
    abort.current?.abort();
    abort.current = controller;
    setBusy(true);
    setError("");
    setStorageFailed(false);
    setPending(null);
    try {
      const catalog = await checkAccess(key.trim(), controller.signal);
      if (controller.signal.aborted) return;
      setModels(catalog);
      setValidatedKey(key.trim());
      const checked = catalog.find(
        (model) => model.id === selected?.id && !modelIncompatibility(model),
      );
      if (selected && !checked) {
        setSelected(null);
        setError(
          "El modelo seleccionado ya no está disponible o no es compatible. Selecciona otro modelo.",
        );
        return;
      }
      if (saving && checked) {
        const next = { key: key.trim(), model: checked };
        if (access.save(next)) onSaved();
        else {
          setPending(next);
          setStorageFailed(true);
        }
      }
    } catch (failure) {
      if (failure.name !== "AbortError") {
        setValidatedKey("");
        setError(failure.message);
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  const valid = validatedKey === key.trim() && !!validatedKey;
  return (
    <dialog
      ref={dialog}
      className="tutor-settings"
      aria-labelledby="tutor-settings-title"
      onCancel={onClose}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = [
          ...dialog.current.querySelectorAll(
            'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
          ),
        ].filter((element) => element.getClientRects().length);
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <header>
        <div className="eyebrow">TU ACCESO PERSONAL</div>
        <h2 id="tutor-settings-title">Configuración del tutor</h2>
      </header>
      <p>
        Elige tu proveedor y configura el acceso en este navegador. Los campos
        son cambios pendientes hasta guardar.
      </p>
      <div className="provider-options" aria-label="Proveedor">
        <button className="secondary" aria-pressed="true">
          OpenRouter
        </button>
        {["OpenAI", "Anthropic", "Modelos locales"].map((name) => (
          <button key={name} className="secondary" disabled>
            {name}
          </button>
        ))}
      </div>
      <label>
        Clave de OpenRouter
        <input
          type="password"
          autoComplete="off"
          value={key}
          disabled={busy}
          onChange={(event) => {
            setKey(event.target.value);
            setValidatedKey("");
            setModels([]);
            setStorageFailed(false);
            setPending(null);
            setError("");
          }}
        />
      </label>
      <p>
        Tu clave se guarda en este navegador, independiente del progreso. Evita
        guardarla en un dispositivo compartido.
      </p>
      <button
        className="secondary"
        disabled={!key.trim() || busy}
        onClick={() => validate()}
      >
        Validar clave
      </button>
      <div aria-live="polite">
        {busy && <p>Validando cambios…</p>}
        {valid && (
          <>
            <p>Credenciales válidas</p>
            <p>
              Esta validación no comprueba el saldo ni garantiza disponibilidad
              para generar respuestas.
            </p>
          </>
        )}
        {error && (
          <p className="storage-warning" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="model-picker">
        <label>
          Buscar modelo por nombre
          <input
            type="search"
            value={search}
            disabled={!valid || busy}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        {selected ? (
          <p>Modelo seleccionado: {selected.name}</p>
        ) : (
          <p>
            Selecciona un modelo explícitamente. No hay un modelo
            predeterminado.
          </p>
        )}
        {valid && (
          <>
            {!models.some((model) => !modelIncompatibility(model)) && (
              <p>
                No hay modelos compatibles en este catálogo. Se requiere texto,
                ventana conocida y soporte de límite de salida.
              </p>
            )}
            <div className="model-options" aria-label="Modelos disponibles">
              {models
                .filter((model) =>
                  model.name
                    .toLocaleLowerCase()
                    .includes(search.toLocaleLowerCase()),
                )
                .map((model) => {
                  const reason = modelIncompatibility(model);
                  return (
                    <button
                      key={model.id}
                      disabled={!!reason || busy}
                      aria-pressed={selected?.id === model.id}
                      className="model-option"
                      onClick={() => {
                        setSelected(model);
                        setStorageFailed(false);
                        setPending(null);
                      }}
                    >
                      <strong>{model.name}</strong>
                      <span>{model.id}</span>
                      <span>
                        {reason ||
                          `${model.context_length.toLocaleString("es")} tokens de contexto`}
                      </span>
                    </button>
                  );
                })}
              {!models.some((model) =>
                model.name
                  .toLocaleLowerCase()
                  .includes(search.toLocaleLowerCase()),
              ) && <p>No hay modelos que coincidan con la búsqueda.</p>}
            </div>
          </>
        )}
      </div>
      {storageFailed && (
        <div role="alert" className="storage-warning">
          <p>
            No se pudo guardar la configuración. Puedes corregir el
            almacenamiento e intentar Guardar de nuevo.
          </p>
          <p>
            Usar solo en esta sesión perderá esta configuración al recargar.
          </p>
          <button
            className="secondary"
            onClick={() => {
              access.useForSession(pending);
              onSaved();
            }}
          >
            Usar solo en esta sesión
          </button>
        </div>
      )}
      <footer>
        <button className="secondary" onClick={onClose}>
          Cancelar
        </button>
        <button
          className="primary"
          disabled={!valid || !selected || busy}
          onClick={() => validate(true)}
        >
          Guardar y volver al tutor
        </button>
      </footer>
    </dialog>
  );
}
