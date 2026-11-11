import { validateRules, compareObservations } from "./personalRuleProfile.js";

const fields = (value, keys) => value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const text = (value) => typeof value === "string" && value.length <= 20000;
const validMessage = (message) => {
  if (fields(message, ["v", "type"]) && message.v === 1 && message.type === "executor-ready") return true;
  if (!message || message.v !== 1 || (typeof message.id !== "string" || message.id.length > 64 || !/^[A-Za-z0-9-]+$/.test(message.id))) return false;
  const base = ["v", "type", "id"];
  if (["loading", "cancelled"].includes(message.type)) return fields(message, base);
  if (message.type === "running") return fields(message, [...base, "version"]) && message.version === "0.28.3";
  if (message.type === "observations") return fields(message, [...base, "output", "variables"]) && text(message.output);
  return ["load-error", "execution-error", "unsupported", "limit", "timeout"].includes(message.type) && fields(message, [...base, "message", "output"]) && text(message.message) && text(message.output);
};

// A caller must opt in only after checking deployment capabilities for its host.
export function createPersonalExecutor({ origin, appOrigin = globalThis.location?.origin, onStatus = () => {} }) {
  let url;
  try { url = new URL(origin); } catch { throw new Error("Se requiere un origen de ejecutor separado."); }
  if (url.origin === appOrigin || url.origin !== origin || !(url.protocol === "https:" || (url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname)))) throw new Error("Se requiere un origen de ejecutor separado.");
  let frame, ready = false, active = null, closed = false, handshake;
  const finish = (result) => {
    const run = active;
    if (!run) return;
    clearTimeout(run.timer);
    active = null;
    run.resolve(result);
  };
  const reset = () => {
    ready = false;
    clearTimeout(handshake);
    frame?.remove();
    frame = document.createElement("iframe");
    frame.hidden = true;
    frame.title = "Ejecutor separado";
    frame.sandbox = "allow-scripts allow-same-origin";
    frame.src = origin + "/";
    document.body.append(frame);
    onStatus("loading");
    handshake = setTimeout(() => { if (!ready && !closed) { frame.remove(); onStatus("error"); } }, 45000);
  };
  const listener = ({ origin: from, source, data }) => {
    if (closed || from !== origin || source !== frame?.contentWindow || !validMessage(data)) return;
    if (data.type === "executor-ready") {
      if (!ready && !active) { clearTimeout(handshake); ready = true; onStatus("ready"); }
      return;
    }
    if (!active || data.id !== active.id) return;
    if (active.phase === "cancelling") {
      if (data.type === "cancelled") { finish({ status: "cancelled", output: "" }); onStatus("ready"); }
      return;
    }
    if (data.type === "loading") { if (active.phase === "requested") active.phase = "loading"; return; }
    if (data.type === "running") {
      if (active.phase !== "loading") return;
      active.phase = "running"; onStatus("running"); return;
    }
    const allowed = active.phase === "running" ? ["observations", "execution-error", "unsupported", "limit", "timeout"] : ["load-error", "execution-error"];
    if (!allowed.includes(data.type)) return;
    let result;
    if (data.type === "observations") {
      try { result = { status: compareObservations(active.rules, { output: data.output, variables: data.variables }) ? "accepted" : "rejected", output: data.output }; }
      catch { result = { status: "error", output: "", message: "Observaciones fuera del perfil." }; }
    } else result = { status: data.type, output: data.output, message: data.message };
    finish(result); onStatus("ready");
  };
  addEventListener("message", listener);
  reset();
  function cancel() {
    if (!active || active.phase === "cancelling") return;
    active.phase = "cancelling";
    clearTimeout(active.timer);
    frame.contentWindow.postMessage({ v: 1, type: "cancel", id: active.id }, origin);
    active.timer = setTimeout(() => { finish({ status: "cancelled", output: "", message: "No se confirmó la cancelación; se reinició el ejecutor." }); reset(); }, 2000);
    onStatus("cancelling");
  }
  return {
    run(code, rules) {
      if (!ready || active) throw new Error("El ejecutor no está disponible.");
      validateRules(rules);
      if (typeof code !== "string" || code.length > 16000) throw new Error("Código fuera del límite.");
      const id = crypto.randomUUID();
      const names = [...new Set(rules.filter((rule) => rule.kind === "variable").map((rule) => rule.name))];
      return new Promise((resolve) => {
        active = { id, rules: structuredClone(rules), phase: "requested", resolve, timer: setTimeout(cancel, 58000) };
        onStatus("loading");
        frame.contentWindow.postMessage({ v: 1, type: "execute", id, code, names }, origin);
      });
    },
    cancel,
    close() { if (closed) return; closed = true; clearTimeout(handshake); finish({ status: "cancelled", output: "" }); removeEventListener("message", listener); frame?.remove(); },
  };
}
