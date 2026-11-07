import React, { useEffect, useRef, useState } from "react";
import { assessmentQuestions } from "./assessment.js";
import { topics } from "./curriculum.js";
import { usePython } from "./usePython.js";

function Icon({ name, ...props }) {
  const paths = {
    book: "M4 4h6a3 3 0 0 1 3 2v15a4 4 0 0 0-3-2H4z M13 6a3 3 0 0 1 3-2h5v15h-5a4 4 0 0 0-3 2",
    grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    code: "m8 7-5 5 5 5 m8-10 5 5-5 5 m-3-14-2 18",
    arrow: "M5 12h14 m-6-6 6 6-6 6",
    check: "m5 12 4 4L19 6",
    play: "m8 5 11 7-11 7z",
    bulb: "M9 18h6 m-6 3h6 M8 14a7 7 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2",
    back: "m14 6-6 6 6 6",
    clock: "M12 8v4l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width="19"
      height="19"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.code} />
    </svg>
  );
}

export default function App() {
  const [view, setView] = useState("courses");
  const [topicId, setTopicId] = useState(topics[0].id);
  const [completed, setCompleted] = useState([]);
  const [assessmentResult, setAssessmentResult] = useState(null);
  const topic = topics.find((item) => item.id === topicId) || topics[0];
  const exerciseCount = topics.reduce(
    (count, item) => count + item.exercises.length,
    0,
  );
  function complete(id) {
    setCompleted((previous) =>
      previous.includes(id) ? previous : [...previous, id],
    );
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            setView("courses");
          }}
        >
          <span className="brand-icon">
            <Icon name="code" />
          </span>
          Python Tutor
        </a>
        <div className="nav-label">TU ESPACIO DE APRENDIZAJE</div>
        <nav aria-label="Navegación principal">
          <button
            className={view === "courses" ? "nav active" : "nav"}
            onClick={() => setView("courses")}
          >
            <Icon name="grid" />
            Cursos y rutas
          </button>
          <button
            className={view !== "courses" ? "nav active" : "nav"}
            onClick={() => setView("learn")}
          >
            <Icon name="book" />
            Aprender
          </button>
        </nav>
        <div className="sidebar-note">
          <span className="tiny-code">&lt;/&gt;</span>
          <strong>Un paso a la vez.</strong>
          <p>La mejor forma de aprender a programar es programando.</p>
        </div>
        <div className="local-note">
          <span className="green-dot" />
          Sin cuenta. A tu ritmo.
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <span className="muted">Tu aprendizaje</span>
            <span className="slash">/</span>
            <strong>
              {view === "courses" ? "Cursos y rutas" : "Python Fundamentos"}
            </strong>
          </div>
          <span className="topbar-tag">
            <Icon name="code" /> Python en tu navegador
          </span>
        </header>
        {view === "courses" ? (
          <main className="courses">
            <div className="eyebrow">APRENDE. PRUEBA. DESCUBRE.</div>
            <h1>Cursos y rutas de aprendizaje</h1>
            <p className="page-subtitle">
              Tu próximo paso empieza con una línea de código.
            </p>
            <section className="welcome-banner">
              <div>
                <span className="pill">DESDE CERO</span>
                <h2>
                  Pequeños pasos.
                  <br />
                  Grandes posibilidades.
                </h2>
                <p>
                  Aprende Python con explicaciones claras y ejercicios
                  <br className="desktop-break" /> que puedes resolver aquí
                  mismo.
                </p>
              </div>
              <div className="banner-code" aria-hidden="true">
                <div className="window-dots">
                  ● ● ● <span>primeros_pasos.py</span>
                </div>
                <pre>
                  <span># Todo comienza con una idea</span>
                  {"\n"}nombre = <em>"Ada"</em>
                  {"\n"}print(<em>"Hola, "</em> + nombre)
                </pre>
                <div className="code-result">
                  ↳ Hola, Ada<span>✓</span>
                </div>
              </div>
            </section>
            <div className="section-heading">
              <h2>Tu ruta de aprendizaje</h2>
              <span>Diseñada para empezar</span>
            </div>
            <article className="course-card">
              <div className="course-art">
                <span className="python-symbol">
                  Py<span>_</span>
                </span>
                <div className="art-grid" />
              </div>
              <div className="course-body">
                <div className="course-tags">
                  <span className="pill">PRINCIPIANTE</span>
                  <span className="muted">Ruta guiada</span>
                </div>
                <h2>Python Fundamentos</h2>
                <p>
                  De tus primeras variables a tus propias funciones. Construye
                  una base sólida, practicando en cada paso.
                </p>
                <div className="course-meta">
                  <span>
                    <Icon name="book" />6 temas
                  </span>
                  <span>
                    <Icon name="code" />
                    Ejercicios interactivos
                  </span>
                </div>
                <div className="course-bottom">
                  <span>{completed.length} ejercicios completados</span>
                  <button className="primary" onClick={() => setView("learn")}>
                    {completed.length ? "Continuar ruta" : "Comenzar ruta"}
                    <Icon name="arrow" />
                  </button>
                </div>
              </div>
            </article>
            <div className="course-footer">
              <Icon name="check" />
              Todo lo que necesitas está aquí: lee, escribe código y observa qué
              sucede.
            </div>
          </main>
        ) : (
          <main className="learning">
            <div className="lesson-heading">
              <div>
                <button
                  className="text-button"
                  onClick={() => setView("courses")}
                >
                  <Icon name="back" />
                  Volver a cursos
                </button>
                <div className="eyebrow">PYTHON FUNDAMENTOS</div>
                <h1>Aprender haciendo</h1>
              </div>
              <div className="route-progress">
                <span>
                  {completed.length} / {exerciseCount} ejercicios
                </span>
                <progress value={completed.length} max={exerciseCount} />
              </div>
            </div>
            {view === "assessment" ? (
              <FinalAssessment
                result={assessmentResult}
                onResult={setAssessmentResult}
                onBack={() => setView("learn")}
              />
            ) : (
              <>
                <div className="topic-strip" aria-label="Temas de la ruta">
                  {topics.map((item, index) => (
                    <button
                      className={
                        topicId === item.id
                          ? "topic-chip selected"
                          : "topic-chip"
                      }
                      key={item.id}
                      aria-current={topicId === item.id ? "step" : undefined}
                      onClick={() => setTopicId(item.id)}
                    >
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      {item.title}
                      {item.exercises.every((exercise) =>
                        completed.includes(exercise.id),
                      ) && <span className="topic-completed">Completado</span>}
                    </button>
                  ))}
                </div>
                {(topicId === topics.at(-1).id ||
                  completed.length === exerciseCount) && (
                  <section className="assessment-invite panel">
                    <div>
                      <h2>Pon a prueba lo aprendido</h2>
                      <p>
                        6 preguntas sobre los seis temas. Sin límite de tiempo;
                        puedes volver a las lecciones cuando quieras.
                      </p>
                    </div>
                    <button
                      className="primary"
                      onClick={() => {
                        setView("assessment");
                        window.scrollTo(0, 0);
                      }}
                    >
                      {assessmentResult
                        ? "Ver evaluación final"
                        : "Comenzar evaluación final"}
                      <Icon name="arrow" />
                    </button>
                  </section>
                )}
                <LearningWorkspace
                  key={topic.id}
                  topic={topic}
                  completed={completed}
                  onComplete={complete}
                />
              </>
            )}
          </main>
        )}
      </div>
    </div>
  );
}

function LearningWorkspace({ topic, completed, onComplete }) {
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const exercise = topic.exercises[exerciseIndex];
  const [code, setCode] = useState(exercise.starter);
  const [hintCount, setHintCount] = useState(0);
  const [result, setResult] = useState(null);
  const [feedback, setFeedback] = useState("");
  const python = usePython((received) => {
    setResult(received);
    if (received.passed) {
      onComplete(exercise.id);
      setFeedback(`¡Correcto! ${exercise.success}`);
    } else
      setFeedback(
        received.error?.startsWith("Ejecución detenida")
          ? received.error
          : received.error
            ? "Revisa el error, corrige tu código y vuelve a ejecutar."
            : `Todavía no. ${exercise.retry}`,
      );
  });
  function selectExercise(index) {
    setExerciseIndex(index);
    setCode(topic.exercises[index].starter);
    setHintCount(0);
    setResult(null);
    setFeedback("");
  }
  const topicCompleted = topic.exercises.filter((item) =>
    completed.includes(item.id),
  ).length;
  return (
    <div className="workspace">
      <section className="lesson-panel panel">
        <div className="panel-heading">
          <span className="lesson-label">
            <Icon name="book" />
            LA LECCIÓN
          </span>
          <span className="muted">
            <Icon name="clock" />
            {topic.duration}
          </span>
        </div>
        <div className="lesson-content">
          <h2>{topic.title}</h2>
          <p className="lesson-intro">{topic.summary}</p>
          {topic.explanation.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <pre className="example">
            <code>{topic.example}</code>
          </pre>
          <div className="takeaway">
            <Icon name="bulb" />
            <p>{topic.takeaway}</p>
          </div>
          <div className="exercise-heading">
            <h3>Ahora te toca a ti</h3>
            <span>
              {topicCompleted} de {topic.exercises.length} ejercicios
              completados
            </span>
          </div>
          <div className="exercise-tabs">
            {topic.exercises.map((item, index) => (
              <button
                key={item.id}
                className={
                  exerciseIndex === index
                    ? "exercise-tab selected"
                    : "exercise-tab"
                }
                onClick={() => selectExercise(index)}
                disabled={python.status === "running"}
              >
                <span
                  className={
                    completed.includes(item.id)
                      ? "exercise-number done"
                      : "exercise-number"
                  }
                >
                  {completed.includes(item.id) ? (
                    <Icon name="check" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span>
                  {index + 1}. {item.title}
                </span>
                {completed.includes(item.id) && (
                  <span className="completed-label">Completado</span>
                )}
              </button>
            ))}
          </div>
          <div className="exercise-prompt">
            <span className="eyebrow">EJERCICIO {exerciseIndex + 1}</span>
            <h3>{exercise.title}</h3>
            <p>{exercise.prompt}</p>
          </div>
          <button
            className="hint-button"
            onClick={() =>
              setHintCount(Math.min(hintCount + 1, exercise.hints.length))
            }
            disabled={hintCount === exercise.hints.length}
          >
            <Icon name="bulb" />
            {hintCount === 0
              ? "Dame una pista"
              : hintCount < exercise.hints.length
                ? "Otra pista"
                : "Todas las pistas mostradas"}
          </button>
          {hintCount > 0 && (
            <div className="hints">
              <strong>
                Pista {hintCount} de {exercise.hints.length}
              </strong>
              {exercise.hints.slice(0, hintCount).map((hint) => (
                <p key={hint}>{hint}</p>
              ))}
            </div>
          )}
        </div>
      </section>
      <section className="runner-column" aria-label="Espacio de práctica">
        <div className="editor-panel panel">
          <div className="editor-toolbar">
            <span className="file-tab">
              <Icon name="code" />
              main.py
            </span>
            <div className="editor-actions">
              {python.status === "running" && (
                <button className="secondary stop-button" onClick={python.stop}>
                  Detener ejecución
                </button>
              )}
              <button
                className="reset-code"
                title="Restablecer código del ejercicio"
                aria-label="Restablecer código"
                disabled={python.status === "running"}
                onClick={() => {
                  setCode(exercise.starter);
                  setResult(null);
                  setFeedback("");
                }}
              >
                ↺
              </button>
              <button
                className="primary run-button"
                disabled={python.status !== "ready"}
                onClick={() => {
                  setFeedback("");
                  setResult(null);
                  python.run(code, exercise.check);
                }}
              >
                <Icon name="play" />
                {python.status === "running" ? "Ejecutando…" : "Ejecutar"}
              </button>
            </div>
          </div>
          <div className="code-area">
            <div className="line-numbers" aria-hidden="true">
              {code.split("\n").map((_, index) => (
                <div key={index}>{index + 1}</div>
              ))}
            </div>
            <textarea
              aria-label="Código Python"
              spellCheck="false"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Tab") {
                  event.preventDefault();
                  const input = event.target;
                  const start = input.selectionStart;
                  const end = input.selectionEnd;
                  setCode(code.slice(0, start) + "    " + code.slice(end));
                  requestAnimationFrame(() => {
                    input.selectionStart = input.selectionEnd = start + 4;
                  });
                }
              }}
              disabled={python.status === "running"}
            />
          </div>
          <div className="editor-footer">
            <span
              className={
                python.status === "ready" ? "runtime ready" : "runtime"
              }
            >
              <span className="green-dot" />
              {python.status === "loading"
                ? "Preparando Python…"
                : python.status === "running"
                  ? "Ejecutando tu código…"
                  : python.status === "error"
                    ? "Python necesita reiniciarse"
                    : "Python listo"}
            </span>
            <span>UTF-8 · Python</span>
          </div>
        </div>
        <div className="output-panel panel">
          <div className="panel-heading">
            <h3>Consola</h3>
            <span className="muted">Resultado de tu código</span>
          </div>
          <div className="console-body">
            <div className="console-label">SALIDA</div>
            <pre
              aria-label="Salida del programa"
              className={result?.output ? "" : "muted"}
            >
              {result?.output ||
                (result
                  ? "Sin salida."
                  : "Tu salida aparecerá aquí al ejecutar.")}
            </pre>
            {result?.error && (
              <>
                <div className="console-label error-label">ERROR</div>
                <pre className="error-output" aria-label="Errores del programa">
                  {result.error}
                </pre>
              </>
            )}
          </div>
        </div>
        <div
          className={`feedback ${result?.passed ? "success" : result ? "retry" : ""}`}
          role="status"
          aria-live="polite"
        >
          {feedback || "Escribe tu solución y pulsa Ejecutar para comprobarla."}
        </div>
        {python.status === "error" && (
          <button className="secondary" onClick={python.restart}>
            Reiniciar Python
          </button>
        )}
        <p className="practice-note">
          <Icon name="check" />
          Cada intento es una oportunidad para aprender.
        </p>
      </section>
    </div>
  );
}

function FinalAssessment({ result, onResult, onBack }) {
  const [answers, setAnswers] = useState(result?.answers || {});
  const resultHeading = useRef(null);
  useEffect(() => {
    if (result) resultHeading.current?.focus();
  }, [result]);
  function submit(event) {
    event.preventDefault();
    if (!assessmentQuestions.every((question) => answers[question.id])) return;
    const responses = assessmentQuestions.map((question) => ({
      questionId: question.id,
      correct: answers[question.id] === question.answer,
    }));
    onResult({
      answers: { ...answers },
      responses,
      score: responses.filter((item) => item.correct).length,
      total: assessmentQuestions.length,
    });
  }
  return (
    <section className="assessment panel">
      <div className="lesson-content">
        <div className="eyebrow">EL ÚLTIMO PASO DE TU RUTA</div>
        <h2>Evaluación final</h2>
        <p>
          Elige una respuesta por pregunta y revisa tu resultado. Puedes
          intentarlo de nuevo para seguir practicando.
        </p>
        {result && (
          <div className="assessment-result" role="status">
            <h3 ref={resultHeading} tabIndex={-1}>
              Tu resultado: {result.score} de {result.total}
            </h3>
            <p>
              {result.score === result.total
                ? "¡Muy bien! Reconoces los fundamentos de Python."
                : "Revisa las explicaciones y vuelve a los temas que quieras practicar."}
            </p>
          </div>
        )}
        <form onSubmit={submit}>
          {assessmentQuestions.map((question, index) => (
            <fieldset
              key={question.id}
              className="assessment-question"
              disabled={Boolean(result)}
            >
              <legend>
                {index + 1}. {question.topic}
              </legend>
              <p>{question.prompt}</p>
              {question.code && (
                <pre className="example">
                  <code>{question.code}</code>
                </pre>
              )}
              <div className="assessment-options">
                {question.options.map((option) => (
                  <label key={option}>
                    <input
                      type="radio"
                      name={question.id}
                      value={option}
                      checked={answers[question.id] === option}
                      onChange={() =>
                        setAnswers({ ...answers, [question.id]: option })
                      }
                      required
                    />
                    {option}
                  </label>
                ))}
              </div>
              {result && (
                <div
                  className={`answer-explanation ${result.answers[question.id] === question.answer ? "correct" : "incorrect"}`}
                >
                  <strong>
                    {result.answers[question.id] === question.answer
                      ? "¡Correcto!"
                      : `Respuesta correcta: ${question.answer}`}
                  </strong>
                  <p>{question.explanation}</p>
                </div>
              )}
            </fieldset>
          ))}
          <div className="assessment-actions">
            {result ? (
              <button
                type="button"
                className="primary"
                onClick={() => {
                  setAnswers({});
                  onResult(null);
                }}
              >
                Intentar de nuevo
              </button>
            ) : (
              <button
                type="submit"
                className="primary"
                disabled={
                  !assessmentQuestions.every((question) => answers[question.id])
                }
              >
                Ver resultado
              </button>
            )}
            <button type="button" className="secondary" onClick={onBack}>
              Volver a las lecciones
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
