// Throwaway: three tutor layouts on Aprender, selected by ?prototype=tutor&variant=A|B|C.
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './TutorWorkspace.prototype.css';

export const tutorPrototype = import.meta.env.DEV && new URLSearchParams(location.search).get('prototype') === 'tutor';
const variants = { A: 'Pestañas · configuración en diálogo', B: 'Tutor lateral · configuración en panel', C: 'Tutor debajo · configuración en pantalla' };
export default function TutorWorkspacePrototype({ children, topic, exercise }) {
  if (!tutorPrototype) return children;
  return <Prototype topic={topic} exercise={exercise}>{children}</Prototype>;
}
function Prototype({ children, topic, exercise }) {
  const [variant, setVariant] = useState(new URLSearchParams(location.search).get('variant') in variants ? new URLSearchParams(location.search).get('variant') : 'A');
  const [tab, setTab] = useState('lesson');
  const [configured, setConfigured] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('idle');
  const [model, setModel] = useState('modelo-demo');
  const [settings, setSettings] = useState(false);
  const [notice, setNotice] = useState('');
  const [replyExercise, setReplyExercise] = useState('');
  const timer = useRef();
  const dialog = useRef();
  const opener = useRef();
  const messageInput = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  function choose(next) {
    setVariant(next);
    const url = new URL(location.href); url.searchParams.set('variant', next); history.replaceState(null, '', url);
  }
  function cycle(delta) { const keys = Object.keys(variants); choose(keys[(keys.indexOf(variant) + delta + 3) % 3]); }
  useEffect(() => {
    function keyboard(e) {
      if (e.target.closest('input,textarea,select,[contenteditable],dialog')) return;
      if (['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); cycle(e.key === 'ArrowRight' ? 1 : -1); }
    }
    window.addEventListener('keydown', keyboard); return () => window.removeEventListener('keydown', keyboard);
  }, [variant]);
  useEffect(() => {
    if (settings) dialog.current.showModal();
    else if (dialog.current?.open) { dialog.current.close(); opener.current?.focus(); }
  }, [settings]);
  function openSettings(e) { opener.current = e.currentTarget; setSettings(true); }
  function send(e) {
    e.preventDefault(); if (!draft.trim() || !configured || status === 'generating') return;
    setMessages(items => [...items, { role: 'Tú', text: draft, exercise: exercise.title }]);
    setDraft(''); setReplyExercise(exercise.title); setStatus('generating');
    timer.current = setTimeout(() => {
      setMessages(items => [...items, { role: 'Tutor', text: 'Empieza por identificar qué valor necesitas mostrar. Puedes usar print para observarlo.\n\nprint("Hola, Python")', exercise: exercise.title }]); setStatus('idle');
    }, 5000);
  }
  function stop() { clearTimeout(timer.current); setStatus('interrupted'); }
  const [lesson, runner] = React.Children.toArray(children.props.children);
  const chat = <section className="tp-chat panel" aria-label="Tutor conversacional">
    <header><div><strong>Tutor del tema</strong><small>{topic.title}</small></div><button onClick={openSettings}>⚙ Configuración</button></header>
    <div className="tp-messages" aria-live="polite">
      {!configured ? <div className="tp-empty"><span className="tp-avatar">✦</span><h3>Aprende acompañado</h3><p>Configura OpenRouter y elige un modelo para conversar sobre este tema.</p><button className="primary" onClick={openSettings}>Configurar tutor</button><p>Puedes seguir leyendo y practicando.</p></div> : <>
        <p className="tp-bubble">Puedo darte pistas y explicar tu código. ¿Qué te gustaría entender?</p>
        {messages.map((message, i) => <article className={'tp-bubble ' + (message.role === 'Tú' ? 'tp-user' : '')} key={i}><small>{message.role} · {message.exercise}</small>{message.text.split('\n\n').map((part, j) => part.startsWith('print') ? <pre key={j}><code>{part}</code><button onClick={() => { navigator.clipboard.writeText(part); setNotice('Código copiado. Pégalo en el editor para probarlo.'); }}>Copiar código</button></pre> : <p key={j}>{part}</p>)}</article>)}
        {status === 'generating' && <p role="status">Preparando una pista… · {replyExercise}</p>}
        {status === 'interrupted' && <p role="status">Respuesta interrumpida. No se reanudará automáticamente.</p>}
        {status === 'error' && <div role="alert"><p>No se pudo obtener una respuesta. Tu mensaje se conserva.</p><button onClick={() => { setStatus('idle'); setDraft(messages.filter(item => item.role === 'Tú').at(-1)?.text || '¿Cómo empiezo?'); messageInput.current?.focus(); }}>Volver a intentar</button><button onClick={openSettings}>Revisar configuración</button></div>}
      </>}
    </div>
    <form onSubmit={send} className="tp-composer"><small>Ejercicio actual: {exercise.title}</small><label htmlFor="tp-message">Tu mensaje</label><textarea id="tp-message" ref={messageInput} value={draft} onChange={e => setDraft(e.target.value)} disabled={!configured} placeholder={configured ? 'Pide una pista o una explicación…' : 'Configura el tutor para empezar'} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(e); } }} /><div><small>Enter envía · Mayús+Enter: nueva línea</small>{status === 'generating' ? <button type="button" onClick={stop}>Detener respuesta</button> : <button className="primary" disabled={!configured || !draft.trim()}>Enviar</button>}</div></form>
  </section>;
  return <>
    {document.querySelector('.sidebar nav') && createPortal(<button className="nav" onClick={openSettings} aria-label="Configuración del tutor">⚙ <span>Configuración</span></button>, document.querySelector('.sidebar nav'))}
    <div className={'tp-layout tp-' + variant}>
      {variant === 'A' ? <><div className="tp-lesson-tabs"><div className="tp-tabs" role="tablist" aria-label="Panel de aprendizaje">{['lesson', 'tutor'].map((key, i) => <button id={'tp-tab-' + key} role="tab" aria-selected={tab === key} aria-controls={'tp-panel-' + key} tabIndex={tab === key ? 0 : -1} key={key} onClick={() => setTab(key)} onKeyDown={e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); const next = e.key === 'Home' ? 'lesson' : e.key === 'End' ? 'tutor' : key === 'lesson' ? 'tutor' : 'lesson'; setTab(next); document.getElementById('tp-tab-' + next).focus(); } }}>{i === 0 ? 'Lección' : '✦ Tutor'}</button>)}</div><div id="tp-panel-lesson" role="tabpanel" aria-labelledby="tp-tab-lesson" hidden={tab !== 'lesson'}>{lesson}</div><div id="tp-panel-tutor" role="tabpanel" aria-labelledby="tp-tab-tutor" hidden={tab !== 'tutor'}>{chat}</div></div>{runner}</> : variant === 'B' ? <>{lesson}{runner}{chat}</> : <><div>{lesson}{chat}</div>{runner}</>}
    </div>
    <dialog ref={dialog} className={'tp-settings tp-settings-' + variant} onCancel={e => { e.preventDefault(); setSettings(false); }} aria-labelledby="tp-settings-title">
      <header><h2 id="tp-settings-title">Configuración del tutor</h2><button onClick={() => setSettings(false)} aria-label="Cerrar configuración">✕</button></header><p>Elige cómo quieres conversar mientras aprendes.</p>
      <fieldset><legend>Proveedor</legend>{['OpenRouter', 'OpenAI', 'Anthropic', 'Modelos locales'].map((name, i) => <button key={name} disabled={i > 0} className={i === 0 ? 'tp-selected' : ''}>{name}{i > 0 ? ' · Próximamente' : ' ✓'}</button>)}</fieldset>
      <label htmlFor="tp-key">API key de OpenRouter</label><input id="tp-key" type="password" placeholder="Usa cualquier texto ficticio" autoComplete="off" /><p className="tp-demo-note">Demostración: no introduzcas credenciales reales. Nada se guarda ni se envía.</p>
      <label htmlFor="tp-model">Modelo</label><select id="tp-model" value={model} onChange={e => setModel(e.target.value)}><option value="modelo-demo">Modelo de demostración</option><option value="otro-demo">Otro modelo de demostración</option></select>
      <footer><button onClick={() => setSettings(false)}>Volver a la lección</button><button className="primary" onClick={() => { setConfigured(true); setSettings(false); setTab('tutor'); setNotice('Tutor habilitado en esta demostración. Tu código se conserva.'); }}>Guardar y volver al tutor</button></footer>
    </dialog>
    <p className="tp-notice" role="status">{notice}</p>
    <aside className="tp-switcher" aria-label="Controles del prototipo"><div><button onClick={() => cycle(-1)} aria-label="Variante anterior">←</button><strong>{variant} · {variants[variant]}</strong><button onClick={() => cycle(1)} aria-label="Variante siguiente">→</button></div><div><span>PROTOTIPO · estado: {configured ? 'configurado' : 'bloqueado'} / {status} / {tab}</span><button onClick={() => { stop(); setStatus('error'); setConfigured(true); setTab('tutor'); }}>Simular error</button><button onClick={() => { stop(); setConfigured(false); setStatus('idle'); setTab('tutor'); }}>Sin acceso</button></div></aside>
  </>;
}
