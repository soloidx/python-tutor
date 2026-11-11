import React, { useEffect, useRef, useState } from "react";
import { incorporateOriginalPath } from "./personalCatalog.js";
import { originalLocalId } from "./identity.js";
import { streamTutor } from "./openRouterTutor.js";
import { learnerGet, learnerRemove, learnerSet, learnerTransaction } from "./learnerStore.js";

const draftKey = "python-tutor:personal-generator:draft:v1";
const debtKey = "python-tutor:personal-generator:pending-consumption:v1";
const defaultBudgets = { calls: 150, tokens: 600000, minutes: 30 };
const policy = "Ayuda a definir una ruta de Python. Pregunta por experiencia y resultado deseado. Advierte limitaciones: Python y biblioteca estándar, sin paquetes ni servicios externos.";
function readDraft() {
  const raw = learnerGet(draftKey);
  if (raw === null) {
    const debtRaw = learnerGet(debtKey);
    const debt = debtRaw === null ? null : JSON.parse(debtRaw);
    if (debt && (!debt.pending || typeof debt.id !== "string" || !Number.isSafeInteger(debt.tokens) || !Number.isSafeInteger(debt.calls))) throw new Error("Consumo pendiente inválido");
    return { raw, objective: "", messages: [], debt, consumption: debt || undefined };
  }
  const parsed = JSON.parse(raw);
  if (typeof parsed.objective !== "string" || !Array.isArray(parsed.messages) || parsed.messages.some(item => !["human", "ai"].includes(item.role) || typeof item.text !== "string")) throw new Error("Borrador inválido");
  return { raw, ...parsed };
}

// Available only in development until runtime and hosting activation checks.
export function PersonalGenerator({ onClose, onIncorporated, onConfigure, access, publication, visible }) {
  const [initial] = useState(() => { try { return readDraft(); } catch { return { raw: null, objective: "", messages: [], damaged: true }; } });
  const saved = useRef(initial.raw);
  const active = useRef(null);
  const release = useRef(null);
  const [owner, setOwner] = useState("idle");
  const [ownershipAttempt, setOwnershipAttempt] = useState(0);
  const [debt, setDebt] = useState(initial.debt || null);
  const [pending, setPending] = useState(initial.raw !== null);
  const [objective, setObjective] = useState(initial.objective);
  const [messages, setMessages] = useState(initial.messages);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(initial.damaged ? "El borrador guardado está dañado. No se reemplazará." : "");
  const [reviewing, setReviewing] = useState(false);
  const [approvedModel, setApprovedModel] = useState(initial.approvedModel || null);
  const [confirmedTokens, setConfirmedTokens] = useState("");
  const [approval, setApproval] = useState(false);
  const [proposal, setProposal] = useState(initial.proposal || null);
  const [operationId, setOperationId] = useState(initial.operationId || null);
  const [incorporationApproved, setIncorporationApproved] = useState(initial.incorporationApproved || false);
  const [budgets, setBudgets] = useState(initial.budgets || defaultBudgets);
  const [consumption, setConsumption] = useState(initial.consumption || { calls: 0, tokens: 0, pending: false });
  const [busy, setBusy] = useState(false);
  useEffect(() => () => { active.current?.abort(); release.current?.(); }, []);
  useEffect(() => {
    if (!visible || owner !== "idle") return;
    if (!navigator.locks) { setOwner("unavailable"); return; }
    setOwner("checking");
    let cancelled = false;
    navigator.locks.request("python-tutor:generator", { ifAvailable: true }, async lock => {
      if (cancelled) return;
      if (!lock) { setOwner("blocked"); return; }
      try {
        const latest = readDraft();
        saved.current = latest.raw;
        setPending(latest.raw !== null);
        setDebt(latest.debt || null);
        setObjective(latest.objective);
        setMessages(latest.messages);
        setProposal(latest.proposal || null);
        setOperationId(latest.operationId || null);
        setIncorporationApproved(latest.incorporationApproved || false);
        setBudgets(latest.budgets || defaultBudgets);
        setApprovedModel(latest.approvedModel || null);
        setConsumption(latest.consumption || { calls: 0, tokens: 0, pending: false });
        setOwner("owned");
      } catch { setOwner("damaged"); return; }
      await new Promise(resolve => { release.current = resolve; });
      release.current = null;
    }).catch(() => { if (!cancelled) setOwner("unavailable"); });
    return () => { cancelled = true; };
  }, [visible, ownershipAttempt]);
  async function save(next, signal) {
    if (initial.damaged || !navigator.locks) throw new Error("Almacenamiento no disponible");
    await navigator.locks.request("python-tutor:learner", () => {
      if (signal?.aborted) throw new DOMException("Abortado", "AbortError");
      if (learnerGet(draftKey) !== saved.current) throw new Error("El borrador cambió en otra pestaña");
      const raw = JSON.stringify({ budgets, approvedModel, ...next });
      learnerSet(draftKey, raw);
      saved.current = raw;
    });
  }
  async function send(nextMessages) {
    if (!access.config?.key) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    try {
      let response = "";
      const result = await streamTutor({ config: access.config, signal: controller.signal, maxTokens: 1024,
        messages: [["system", policy], ...nextMessages.map(item => [item.role, item.text])],
        onText: text => { response += text; },
      });
      if (controller.signal.aborted) return;
      if (result.finishReason !== "stop" || !response.trim()) throw new Error("Respuesta incompleta");
      const complete = [...nextMessages, { role: "ai", text: response }];
      await save({ objective, messages: complete, consumption }, controller.signal);
      if (!controller.signal.aborted) setMessages(complete);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message || "No se pudo completar la conversación.");
    } finally {
      if (active.current === controller) { active.current = null; setBusy(false); }
    }
  }
  async function start(event) {
    event.preventDefault();
    try {
      const next = messages.length ? messages : [{ role: "human", text: objective }];
      const retained = proposal && objective === JSON.parse(saved.current || "{}").objective ? { proposal, operationId, incorporationApproved } : {};
      await save({ objective, messages: next, consumption, ...retained });
      if (!retained.proposal) { setProposal(null); setOperationId(null); setIncorporationApproved(false); }
      setMessages(next);
      setPending(true);
      setError("");
      setReviewing(true);
      if (approvedModel && approvedModel === access.config?.model?.id && !proposal) setApproval(true);
      if (next.length === 1 && access.config?.key && !consumption.pending) await send(next);
    } catch (failure) { setError(`${failure.message}. Tu objetivo permanece en esta sesión.`); }
  }
  async function reply(event) {
    event.preventDefault();
    const next = [...messages, { role: "human", text: message.trim() }];
    try {
      await save({ objective, messages: next, consumption });
      setMessages(next);
      setMessage("");
      await send(next);
    } catch (failure) { setError(`${failure.message}. Tu mensaje permanece en esta sesión.`); }
  }
  async function generate() {
    if (Object.values(budgets).some(value => !Number.isSafeInteger(value) || value <= 0) || consumption.pending || consumption.calls >= budgets.calls || consumption.tokens + (access.config?.model?.context_length || 1024) > budgets.tokens) { setError("No se puede iniciar otra llamada: revisa el consumo y el presupuesto."); return; }
    if (access.status !== "ready") { setError("Configura un modelo compatible antes de continuar. No se sustituirá automáticamente."); return; }
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    try {
      const pending = { ...consumption, calls: consumption.calls + 1, pending: true };
      await save({ objective, messages, consumption: pending, approvedModel: access.config.model.id }, controller.signal);
      setApprovedModel(access.config.model.id);
      setConsumption(pending);
      const available = publication.catalog.courses.filter(record => !record.retiredOriginal).map(record => publication.courses[record.id]).filter(Boolean).map(course => ({ id: originalLocalId(course.id), title: course.title, description: course.description })).filter(course => course.id);
      let response = "";
      const result = await streamTutor({ config: access.config, signal: controller.signal, maxTokens: 1024,
        timeoutMs: 120000, messages: [["system", "Devuelve solo JSON con title, description y courseIds. Elige únicamente IDs de cursos disponibles; no generes cursos nuevos. Máximo 10 cursos, sin repetir. Si no hay una ruta adecuada, devuelve courseIds vacío."],
          ["human", JSON.stringify({ conversation: messages, available })]],
        onText: text => { response += text; },
      });
      if (controller.signal.aborted) return;
      const confirmed = result.usage && Number.isSafeInteger(result.usage.total_tokens)
        ? { ...pending, tokens: pending.tokens + result.usage.total_tokens, pending: false } : pending;
      await save({ objective, messages, consumption: confirmed, approvedModel: access.config.model.id }, controller.signal);
      setConsumption(confirmed);
      if (result.finishReason !== "stop") throw new Error("El modelo devolvió una respuesta incompleta o incompatible. Selecciona otro modelo explícitamente.");
      let plan;
      try { plan = JSON.parse(response); } catch { throw new Error("El modelo no produjo un esquema compatible. Selecciona otro modelo explícitamente."); }
      if (!plan || typeof plan.title !== "string" || !plan.title.trim() || typeof plan.description !== "string" || !plan.description.trim() || !Array.isArray(plan.courseIds) || !plan.courseIds.length || plan.courseIds.length > 10 || new Set(plan.courseIds).size !== plan.courseIds.length || plan.courseIds.some(id => typeof id !== "string" || !available.some(course => course.id === id))) throw new Error("El esquema no contiene únicamente originales disponibles. No se incorporará contenido nuevo sin validar.");
      const id = crypto.randomUUID();
      await save({ objective, messages, consumption: confirmed, approvedModel: access.config.model.id, proposal: plan, operationId: id }, controller.signal);
      if (controller.signal.aborted) return;
      setOperationId(id);
      setProposal(plan);
      setApproval(false);
    } catch (failure) { if (!controller.signal.aborted) setError(failure.message || "No se pudo generar el esquema."); }
    finally { if (active.current === controller) { active.current = null; setBusy(false); } }
  }
  async function incorporate() {
    setIncorporationApproved(true);
    setBusy(true);
    try {
      await save({ objective, messages, consumption, approvedModel, proposal, operationId, incorporationApproved: true });
      const result = await incorporateOriginalPath({ publication, proposal, operationId, consumption });
      if (result.status === "conflict") throw new Error("Los datos cambiaron en otra pestaña. Revisa la operación antes de reintentar.");
      await onIncorporated();
      release.current?.();
      setOwner("idle");
      onClose();
    } catch (failure) { setError(`No se pudo guardar la ruta. ${failure.message} Puedes reintentar sin aprobar nuevamente.`); }
    finally { setBusy(false); }
  }
  async function confirmConsumption(event) {
    event.preventDefault();
    const tokens = Number(confirmedTokens);
    if (!confirmedTokens.trim() || !Number.isSafeInteger(tokens) || tokens < 0) { setError("Indica el consumo confirmado en tokens."); return; }
    const confirmed = { ...consumption, tokens: consumption.tokens + tokens, pending: false };
    try {
      if (debt) {
        await navigator.locks.request("python-tutor:learner", () => {
          const current = learnerGet(debtKey);
          if (current !== JSON.stringify(debt)) throw new Error("El consumo cambió en otra pestaña");
          learnerTransaction(() => {
            learnerSet(`python-tutor:personal-generator:consumption:v1:${debt.id}`, JSON.stringify(confirmed));
            learnerRemove(debtKey);
          });
        });
        setDebt(null); setConsumption({ calls: 0, tokens: 0, pending: false });
      } else {
        await save({ objective, messages, consumption: confirmed, approvedModel, ...(proposal ? { proposal, operationId, incorporationApproved } : {}) });
        setConsumption(confirmed);
      }
      setConfirmedTokens(""); setError("");
    } catch (failure) { setError(`No se pudo guardar el consumo: ${failure.message}.`); }
  }
  async function discard() {
    active.current?.abort();
    try {
      await navigator.locks.request("python-tutor:learner", () => {
        if (learnerGet(draftKey) !== saved.current) throw new Error("El borrador cambió en otra pestaña");
        learnerTransaction(() => {
          if (consumption.pending) learnerSet(debtKey, JSON.stringify({ ...consumption, id: operationId || crypto.randomUUID() }));
          learnerRemove(draftKey);
        });
        saved.current = null;
      });
      setObjective(""); setMessages([]); setProposal(null); setOperationId(null);
      setIncorporationApproved(false);
      if (consumption.pending) {
        const outstanding = JSON.parse(learnerGet(debtKey));
        setDebt(outstanding); setConsumption(outstanding);
      } else setConsumption({ calls: 0, tokens: 0, pending: false });
      setBudgets(defaultBudgets); setApprovedModel(null);
      setPending(false); setError("");
    } catch (failure) { setError(`No se pudo descartar la propuesta: ${failure.message}.`); }
  }
  async function invalidate(close = false) {
    active.current?.abort();
    active.current = null;
    setBusy(false);
    try {
      await save({ objective, messages, consumption, approvedModel: null });
      setApprovedModel(null);
      setProposal(null);
      setOperationId(null);
      setIncorporationApproved(false);
      setApproval(false);
      if (close) setReviewing(false);
    } catch (failure) { setError(`No se pudo guardar la cancelación: ${failure.message}. La propuesta anterior podría recuperarse al recargar.`); }
  }
  return <main className="courses catalog-page">
    <button onClick={onClose}>Volver a Learning paths</button>
    <h1>Crear ruta personal</h1>
    {owner === "blocked" && <><p role="alert">Otra pestaña controla el generador.</p><button onClick={() => { setOwner("idle"); setOwnershipAttempt(value => value + 1); }}>Recuperar control</button></>}
    {owner === "unavailable" && <p role="alert">Este navegador no permite proteger el generador entre pestañas.</p>}
    {owner === "damaged" && <p role="alert">El borrador guardado está dañado y se conserva para recuperación.</p>}
    {owner === "owned" && <>
    {error && <p role="alert">{error}</p>}
    {consumption.pending && <section><p role="status">Consumo pendiente de confirmar. Se bloquean nuevas llamadas; la llamada interrumpida puede haber consumido saldo.</p>
      <form onSubmit={confirmConsumption}><label>Tokens consumidos en la llamada<input aria-label="Tokens consumidos en la llamada" type="number" min="0" value={confirmedTokens} onChange={event => setConfirmedTokens(event.target.value)} /></label><button>Confirmar consumo</button></form></section>}
    {!reviewing && <form onSubmit={start}>
      {pending && <p>Hay una propuesta pendiente. Continúa o descártala antes de iniciar otra.</p>}
      <label>Objetivo de aprendizaje<textarea aria-label="Objetivo de aprendizaje" readOnly={pending} value={objective} onChange={event => setObjective(event.target.value)} /></label>
      <button className="primary" disabled={!objective.trim() || initial.damaged || !!debt}>Continuar</button>
      {pending && <button type="button" onClick={discard}>Descartar propuesta</button>}
    </form>}
    {messages.map((item, index) => <p key={index}>{item.text}</p>)}
    {reviewing && <>
      {busy && <p role="status">Esperando respuesta…</p>}
      {access.config?.key && <form onSubmit={reply}>
        <label>Mensaje al generador<textarea aria-label="Mensaje al generador" value={message} onChange={event => setMessage(event.target.value)} /></label>
        <button disabled={busy || approval || !!proposal || consumption.pending || !message.trim()}>Enviar mensaje</button>
      </form>}
      {!approval && !proposal && <button disabled={busy} onClick={() => setApproval(true)}>Preparar generación</button>}
      {approval && <section aria-label="Aprobación de generación">
        <p>Modelo: {access.config?.model?.id || "sin configurar"}. Presupuesto inicial: 150 llamadas, 600.000 tokens y 30 minutos de validación.</p>
        <p>El entorno permite Python y biblioteca estándar; no admite paquetes, servicios externos, archivos del equipo ni entrada interactiva. Adapta tu objetivo antes de aprobar.</p>
        <button onClick={onConfigure}>Cambiar configuración</button>
        <label>Límite de llamadas<input aria-label="Límite de llamadas" type="number" min="1" value={budgets.calls} onChange={event => setBudgets({ ...budgets, calls: Number(event.target.value) })} /></label>
        <label>Límite de tokens<input aria-label="Límite de tokens" type="number" min="1" value={budgets.tokens} onChange={event => setBudgets({ ...budgets, tokens: Number(event.target.value) })} /></label>
        <label>Minutos de validación<input aria-label="Minutos de validación" type="number" min="1" value={budgets.minutes} onChange={event => setBudgets({ ...budgets, minutes: Number(event.target.value) })} /></label>
        <button disabled={busy || consumption.pending} onClick={generate}>{approvedModel === access.config?.model?.id ? "Reintentar generación" : "Aprobar generación"}</button>
      </section>}
      {proposal && <section aria-label="Revisión del temario">
        <h2>{proposal.title}</h2><p>{proposal.description}</p>
        <p>{proposal.courseIds.length} cursos</p>
        {proposal.courseIds.map(id => {
          const course = Object.values(publication.courses).find(item => originalLocalId(item.id) === id);
          return <details key={id}><summary>{course.title}</summary><p>{course.description}</p><ul>{course.topics.map(topic => <li key={topic.id}>{topic.title}: {topic.exercises.length} ejercicios</li>)}</ul></details>;
        })}
        <p>Los originales conservan su validación editorial e integridad; la revisión automática puede dejar errores.</p>
        <button disabled={busy} onClick={incorporate}>{incorporationApproved ? "Reintentar guardado" : "Incorporar ruta"}</button>
        <button onClick={() => invalidate()}>Pedir cambios</button>
      </section>}
      <button onClick={() => invalidate(true)}>Cancelar generación</button>
    </>}
    </>}
  </main>;
}
