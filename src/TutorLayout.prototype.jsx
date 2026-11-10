// Throwaway: three tutor layouts on the existing app route, ?tutor-prototype&variant=A|B|C.
// Question: how can the tutor stay within reach while solving a practice exercise?
// All interactions are local simulations; no tutor calls or learning mutations.
import React, { useEffect, useRef, useState } from "react";
import { createPracticeRound } from "./practiceRound.js";
import { Icon } from "./Icon.jsx";
import "./TutorLayout.prototype.css";

const variants = { A: "Panel lateral", B: "Pestañas", C: "Ventana flotante" };
export default function TutorLayoutPrototype({ publication }) {
  const [round] = useState(() => createPracticeRound(publication));
  const [index, setIndex] = useState(() => Math.max(0, round.entries.findIndex(item => item.exercise.type !== "choice")));
  const [variant, setVariant] = useState(() => {
    const value = new URLSearchParams(location.search).get("variant");
    return variants[value] ? value : "A";
  });
  const [open, setOpen] = useState(true);
  const [drafts, setDrafts] = useState({});
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState({});
  const [configured, setConfigured] = useState(true);
  const [output, setOutput] = useState("");
  const trigger = useRef(null);
  const composer = useRef(null);
  const entry = round.entries[index];
  const topicKey = entry ? `${entry.course.id}:${entry.topic.id}` : "";
  const history = messages[topicKey] || [];
  function cycle(delta) {
    setVariant(previous => {
      const keys = Object.keys(variants);
      const next = keys[(keys.indexOf(previous) + delta + keys.length) % keys.length];
      const url = new URL(location.href);
      url.searchParams.set("variant", next);
      window.history.replaceState(window.history.state, "", url);
      return next;
    });
  }
  useEffect(() => {
    const handler = event => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
      if (event.target.closest("input, textarea, select, [contenteditable]")) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault(); cycle(event.key === "ArrowLeft" ? -1 : 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  function toggleTutor() {
    setOpen(value => !value);
  }
  useEffect(() => { if (open && variant !== "A") composer.current?.focus(); }, [open, variant]);
  function closeTutor() { setOpen(false); trigger.current?.focus(); }
  function send(event) {
    event.preventDefault();
    if (!question.trim()) return;
    setMessages(previous => ({ ...previous, [topicKey]: [...history, question.trim()] }));
    setQuestion("");
  }
  const tutor = <aside id="prototype-tutor" className="tl-tutor" aria-label="Tutor del tema">
    <header className="tl-panel-heading"><div><strong>Tutor</strong><small>{entry?.topic.title} · Conversación del tema</small></div><button className="secondary" onClick={closeTutor} aria-label="Cerrar tutor">×</button></header>
    <div className="tl-chat" aria-live="polite">
      <span className="tl-context">Contexto: {entry?.exercise.title}</span>
      {configured ? <><h2>Pensemos el siguiente paso</h2><p>Puedes pedirme una pista sobre el ejercicio o compartir qué parte no entiendes.</p><button className="secondary" onClick={() => setQuestion("Dame una pista sin resolver el ejercicio")}>Dame una pista</button>
        {history.map((message, i) => <div key={i}><p className="tl-question">{message}</p><p className="tl-answer"><strong>Respuesta de ejemplo</strong><br />Descompón el enunciado: ¿qué datos tienes y qué resultado necesitas? Prueba primero con un caso pequeño.</p></div>)}
      </> : <><h2>Aprende con ayuda, a tu ritmo</h2><p>Configura el tutor para conversar sobre este ejercicio.</p><button className="primary" onClick={() => setConfigured(true)}>Simular tutor configurado</button></>}
    </div>
    <form className="tl-composer" onSubmit={send}><label htmlFor="prototype-question">Mensaje al tutor</label><textarea ref={composer} id="prototype-question" value={question} onChange={e => setQuestion(e.target.value)} disabled={!configured} placeholder="¿En qué te ayudo?" /><button className="primary" disabled={!configured || !question.trim()}>Enviar</button><small>Conversación simulada</small></form>
  </aside>;
  const exercise = entry && <div className="tl-exercise" hidden={variant === "B" && open}>
    <div className="tl-prompt"><span className="eyebrow">EJERCICIO DE {entry.exercise.type === "choice" ? "SELECCIÓN" : "CÓDIGO"}</span><h2>{entry.exercise.title}</h2><p>{entry.exercise.prompt}</p></div>
    {entry.exercise.type === "choice" ? <fieldset className="tl-choices"><legend>Elige una respuesta</legend>{entry.exercise.options.map(option => <label key={option.id}><input type="radio" name={entry.id} checked={drafts[entry.id] === option.id} onChange={() => setDrafts(previous => ({ ...previous, [entry.id]: option.id }))} />{option.text}</label>)}</fieldset> : <><div className="tl-editor"><header><strong>main.py</strong><button className="primary" onClick={() => setOutput("Salida simulada · Aquí verías el resultado de tu código.")}>▷ Ejecutar demo</button></header><textarea aria-label="Código de ejemplo" spellCheck="false" value={drafts[entry.id] ?? entry.exercise.starter ?? "# Escribe tu solución aquí"} onChange={e => setDrafts(previous => ({ ...previous, [entry.id]: e.target.value }))} /></div>
    <div className="tl-console"><strong>Consola</strong><p>{output || "Tu salida aparecerá aquí al ejecutar."}</p></div></>}
  </div>;
  return <div className={`app-shell practice-shell tl-root tl-${variant}`}>
    <aside className="sidebar"><a className="brand" href="/"><span className="brand-icon"><Icon name="code" /></span>Python Tutor</a><div className="nav-label">TU ESPACIO DE APRENDIZAJE</div><nav aria-label="Navegación principal"><a className="nav" href="/">Cursos y rutas</a><span className="nav active">Práctica</span></nav><div className="sidebar-note"><strong>Un paso a la vez.</strong><p>La mejor forma de aprender a programar es programando.</p></div></aside>
    <div className="main-shell"><header className="topbar"><span>Tu aprendizaje</span><span className="topbar-tag">Python en tu navegador</span></header>
      <main className="practice-page"><header className="practice-heading"><div><span className="eyebrow">APRENDE HACIENDO</span><h1>Práctica</h1><p>Una ronda a tu ritmo. Tu progreso de curso es independiente.</p></div></header>
      <div className="round-progress"><strong>0 de {round.entries.length} resueltos</strong><progress value="0" max={round.entries.length || 1} /></div>
      {!entry ? <p>No hay ejercicios disponibles en este catálogo.</p> : <div className="practice-grid"><nav className="practice-rail" aria-label="Ejercicios de la ronda"><h2>Tu ronda</h2>{round.entries.map((item, i) => <button key={item.id} className={`round-exercise ${index === i ? "selected" : ""}`} onClick={() => { setIndex(i); setQuestion(""); setOutput(""); }}><span className="round-step">{i + 1}</span><span><strong>{item.exercise.title}</strong><small>{item.topic.title}</small><small>Pendiente</small></span></button>)}</nav>
        <section className="practice-workspace"><div className="practice-context"><div><strong>{entry.topic.title}</strong><small>{entry.course.title}</small></div>{variant !== "B" && <button ref={trigger} className={open ? "secondary" : "primary"} onClick={toggleTutor} aria-expanded={open} aria-controls="prototype-tutor">{open ? "Ocultar tutor" : "Abrir tutor"}</button>}</div>
        {variant === "B" && <div className="tl-tabs"><button ref={trigger} className={!open ? "selected" : ""} onClick={() => setOpen(false)} aria-pressed={!open}>Ejercicio</button><button className={open ? "selected" : ""} onClick={() => setOpen(true)} aria-pressed={open}>Tutor {history.length > 0 && `(${history.length})`}</button></div>}
        <div className={`tl-work ${open ? "tl-open" : ""}`}>{exercise}{open && tutor}</div>
        </section></div>}
      </main>
    </div>
    <div className="tl-prototype-controls"><div className="tl-state">PROTOTIPO · {open ? "Tutor abierto" : "Tutor cerrado"} · {history.length} mensajes · Datos en memoria</div><div className="tl-switcher"><button aria-label="Variante anterior" onClick={() => cycle(-1)}>←</button><strong>{variant} · {variants[variant]}</strong><button aria-label="Variante siguiente" onClick={() => cycle(1)}>→</button><label><input type="checkbox" checked={configured} onChange={e => setConfigured(e.target.checked)} /> Configurado</label></div></div>
  </div>;
}
