import { useEffect, useRef, useState } from "react";
import {
  AccessError,
  checkAccess,
  modelIncompatibility,
} from "./openRouterAccess.js";

const storageKey = "python-tutor-access-v1";
function loadAccess() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (typeof saved?.key === "string" && typeof saved?.model?.id === "string")
      return saved;
  } catch {
    /* An unavailable or malformed store cannot grant access. */
  }
  return null;
}

export function useTutorAccess({ beforeApply } = {}) {
  const [config, setConfig] = useState(loadAccess);
  const [status, setStatus] = useState(() => (config ? "checking" : "missing"));
  const [message, setMessage] = useState("");
  const [sessionOnly, setSessionOnly] = useState(false);
  const checkVersion = useRef(0);
  const activeCheck = useRef(null);
  async function recheck() {
    if (!config?.key) return;
    activeCheck.current?.abort();
    const controller = new AbortController();
    activeCheck.current = controller;
    const version = ++checkVersion.current;
    setStatus("checking");
    setMessage("");
    try {
      const models = await checkAccess(config.key, controller.signal);
      if (version !== checkVersion.current) return;
      const model = models.find((item) => item.id === config.model.id);
      if (!model || modelIncompatibility(model))
        throw new AccessError(
          "model",
          "El modelo guardado ya no está disponible o no es compatible. Selecciona otro modelo explícitamente en Configuración.",
        );
      setConfig((previous) => ({ ...previous, model }));
      setStatus("ready");
    } catch (error) {
      if (version !== checkVersion.current || error.name === "AbortError")
        return;
      setStatus(error.kind || "service");
      setMessage(error.message);
    }
  }
  useEffect(() => {
    if (config) recheck();
    return () => {
      ++checkVersion.current;
      activeCheck.current?.abort();
    };
    // Saved changes have already been checked; only recovered access needs this check.
  }, []);

  function apply(next, temporary) {
    beforeApply?.();
    ++checkVersion.current;
    activeCheck.current?.abort();
    setConfig(next);
    setStatus("ready");
    setMessage("");
    setSessionOnly(temporary);
  }
  function save(next) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      return false;
    }
    apply(next, false);
    return true;
  }
  return {
    config,
    status,
    message,
    sessionOnly,
    recheck,
    reportIssue({ kind, message: explanation }) {
      ++checkVersion.current;
      activeCheck.current?.abort();
      setStatus(kind);
      setMessage(explanation);
    },
    save,
    useForSession: (next) => apply(next, true),
  };
}
