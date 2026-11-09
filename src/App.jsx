import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { assessAnswers, assessmentReview } from "./assessment.js";
import {
  emptyProgress,
  courseProgress,
  resumeLabel,
  loadProgress,
  saveProgress,
} from "./progress.js";
import { resetLearner } from "./learnerReset.js";
import { useTutorAccess } from "./tutorAccess.js";
import { TutorPanel, TutorSettings } from "./TutorAccess.jsx";
import { createConversationService } from "./tutorConversation.js";
import { captureContext } from "./tutorContext.js";
import { usePython } from "./usePython.js";

import pathArt from "./assets/resources/path.svg";
import courseArt from "./assets/resources/course.svg";
import topicArt from "./assets/resources/topic.svg";

function ResourceArt({ kind }) {
  return <span className={`resource-art resource-art-${kind}`} aria-hidden="true"><img src={{ path: pathArt, course: courseArt, topic: topicArt }[kind]} alt="" /></span>;
}

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

export default function App({ publication }) {
  const { catalog, courses } = publication;
  const [conversation] = useState(createConversationService);
  const recoveryWarning = useSyncExternalStore(
    conversation.subscribe,
    () => conversation.getSnapshot().recoveryWarning,
  );
  const access = useTutorAccess({ beforeApply: conversation.cancel });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [learningTab, setLearningTab] = useState("lesson");
  const focusTutorAfterSettings = useRef(false);
  const rootLocation = {
    screen: "paths",
    pathId: null,
    courseId: null,
    topicId: null,
  };
  const [location, setLocation] = useState(rootLocation);
  const [progressByCourse, setProgressByCourse] = useState(() =>
    Object.fromEntries(
      Object.values(courses).map((course) => [course.id, loadProgress(course)]),
    ),
  );
  const [confirmReset, setConfirmReset] = useState(false);
  const [workspaceVersion, setWorkspaceVersion] = useState(0);
  const resetButton = useRef(null);
  const [resetError, setResetError] = useState("");
  const [resumeNotice, setResumeNotice] = useState("");
  useEffect(() => {
    history.replaceState(rootLocation, "");
    const onBack = (event) => {
      conversation.cancel();
      setResumeNotice("");
      setLocation(event.state?.screen ? event.state : rootLocation);
    };
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, []);
  useEffect(() => {
    if (!settingsOpen && focusTutorAfterSettings.current) {
      focusTutorAfterSettings.current = false;
      document.getElementById("tutor-tab")?.focus();
    }
  }, [settingsOpen]);
  function navigate(next) {
    setConfirmReset(false);
    conversation.cancel();
    setResumeNotice("");
    const value = { ...location, ...next };
    if (value.screen === "paths") Object.assign(value, rootLocation);
    else if (value.screen === "courses")
      Object.assign(value, { courseId: null, topicId: null });
    history.pushState(value, "");
    setLocation(value);
    window.scrollTo(0, 0);
  }
  const path = catalog.learningPaths.find(
    (item) => item.id === location.pathId,
  );
  const course = courses[location.courseId];
  const state = course ? progressByCourse[course.id] : null;
  const assessmentResult = assessmentReview(course?.assessment?.questions, state?.progress.assessmentResult);
  const completed = state?.progress.completed || [];
  const topic =
    course?.topics.find((item) => item.id === location.topicId) ||
    course?.topics[0];
  const view = location.screen;
  const storageMessage =
    state?.message ||
    (!course
      ? Object.values(progressByCourse).find((item) => item.message)?.message
      : "") ||
    "";
  function updateProgress(id, change) {
    setProgressByCourse((previous) => {
      const progress = { ...previous[id].progress, ...change };
      const saved = saveProgress(courses[id], progress);
      return {
        ...previous,
        [id]: {
          progress,
          message: saved
            ? previous[id].message
            : [
                previous[id].message,
                previous[id].message.includes("No se pudo guardar el progreso")
                  ? ""
                  : "No se pudo guardar el progreso en este navegador. Tu avance solo está disponible en esta sesión.",
              ].filter(Boolean).join(" "),
        },
      };
    });
  }
  useEffect(() => {
    if (location.screen === "learn" && course && topic) {
      updateProgress(course.id, { topicId: topic.id });
    }
  }, [location.screen, location.courseId, location.topicId]);
  function openTopic(selectedCourse, selectedTopic) {
    navigate({
      screen: "learn",
      courseId: selectedCourse.id,
      topicId: selectedTopic.id,
    });
  }
  function startCourse(selectedCourse) {
    const progress = progressByCourse[selectedCourse.id].progress;
    const previous = selectedCourse.topics.find(
      (item) => item.id === progress.topicId,
    );
    const retired = progress.topicId && !previous;
    const destination = previous ||
      (retired && selectedCourse.topics.find((item) =>
        item.exercises.some((exercise) => !progress.completed.includes(exercise.id)),
      )) || selectedCourse.topics[0];
    openTopic(selectedCourse, destination);
    if (retired) {
      setResumeNotice(
        `Tu último tema ya no está disponible. Abrimos «${destination.title}», ${
          courseProgress(selectedCourse, progress).status === "Completado"
            ? "el primer tema del curso porque todos sus ejercicios vigentes están aprobados"
            : "el primer tema con ejercicios pendientes"
        }.`,
      );
    }
  }
  function resetProgress() {
    const global = confirmReset === "all";
    const { cleared, warning } = resetLearner({
      all: global,
      courseId: global ? undefined : course.id,
      progressByCourse,
      courses,
      conversation,
    });
    setProgressByCourse((previous) => ({ ...previous, ...cleared }));
    setResetError(warning);
    navigate(global ? rootLocation : { screen: "topics", topicId: null });
    setWorkspaceVersion((value) => value + 1);
    setConfirmReset(false);
    resetButton.current?.focus();
  }
  const currentProgress = course ? courseProgress(course, state.progress) : null;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            navigate(rootLocation);
          }}
        >
          <span className="brand-icon">
            <Icon name="code" />
          </span>
          Python Tutor
        </a>
        <div className="nav-label">TU ESPACIO DE APRENDIZAJE</div>
        <nav aria-label="Navegación principal">
          <button className="nav" onClick={() => navigate(rootLocation)}>
            <Icon name="grid" />
            Cursos y rutas
          </button>
          {course && (
            <button className="nav" onClick={() => startCourse(course)}>
              <Icon name="book" />
              Aprender
            </button>
          )}
          <button
            className="nav configuration-nav"
            aria-label="Configuración"
            onClick={() => setSettingsOpen(true)}
          >
            <Icon name="grid" />
            Configuración
          </button>
        </nav>
        <div className="sidebar-note">
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
          <span>Tu aprendizaje</span>
          <span className="topbar-tag">
            <Icon name="code" /> Python en tu navegador
          </span>
        </header>
        <nav className="learning-breadcrumbs" aria-label="Contexto de aprendizaje">
          <button
            className="text-button"
            onClick={() => navigate(rootLocation)}
          >
            Todas las rutas
          </button>
          {path && (
            <button
              aria-label={path.title}
              className="text-button"
              onClick={() => navigate({ screen: "courses" })}
            >
              {path.title}
            </button>
          )}
          {course && (
            <button
              aria-label={course.title}
              className="text-button"
              onClick={() => navigate({ screen: "topics" })}
            >
              {course.title}
            </button>
          )}
          {view === "learn" && <span>{topic.title}</span>}
        </nav>
        {recoveryWarning && (
          <p className="storage-warning" role="alert">{recoveryWarning}</p>
        )}
        {resumeNotice && (
          <p className="storage-warning" role="alert">{resumeNotice}</p>
        )}
        {(resetError || storageMessage) && (
          <p className="storage-warning learning-notice" role="alert">{resetError || storageMessage}</p>
        )}
        {view === "paths" && (
          <main className="courses catalog-page">
            <header className="catalog-heading">
              <div className="eyebrow">TU PRÓXIMO PASO</div>
              <h1>Cursos y rutas de aprendizaje</h1>
              <p className="page-subtitle">Elige un objetivo y aprende a tu ritmo, practicando desde el primer tema.</p>
              <span className="catalog-count">{catalog.learningPaths.length} rutas disponibles · Acceso libre a todos los temas</span>
            </header>
            <div className="resource-grid">
              {catalog.learningPaths.map((item, index) => {
                const summaries = item.courseIds.map(id => courseProgress(courses[id], progressByCourse[id].progress));
                const status = summaries.every(s => s.status === "Completado") ? "Completado" : summaries.some(s => s.approved > 0) ? "En progreso" : "Sin iniciar";
                const done = summaries.filter(s => s.status === "Completado").length;
                return <article className="resource-card path-card" key={item.id}>
                  <div className="resource-card-top"><ResourceArt kind="path" /><span className="resource-type">RUTA {String(index + 1).padStart(2, "0")}</span><span className={`status-badge ${status === "Completado" ? "complete" : ""}`}>{status}</span></div>
                  <h2>{item.title}</h2><p className="resource-description">{item.description}</p>
                  <div className="resource-meta"><span>{item.courseIds.length} {item.courseIds.length === 1 ? "curso" : "cursos"}</span><span>{done} completados</span></div>
                  <div className="path-course-preview">{item.courseIds.map(id => <span key={id}><Icon name="book" />{courses[id].title}</span>)}</div>
                  <button className="primary" aria-label={`Explorar ${item.title}`} onClick={() => navigate({ screen: "courses", pathId: item.id, courseId: null, topicId: null })}>Explorar ruta <Icon name="arrow" /></button>
                </article>;
              })}
            </div>
          </main>
        )}
        {view === "courses" && (
          <main className="courses catalog-page">
            <header className="catalog-heading"><div className="eyebrow">RUTA DE APRENDIZAJE</div><h1>{path.title}</h1><p>{path.description}</p><span className="catalog-count">{path.courseIds.length} {path.courseIds.length === 1 ? "curso" : "cursos"} · Puedes comenzar por cualquiera</span></header>
            <div className="resource-grid">
              {path.courseIds.map((id, index) => {
                const item = courses[id];
                const summary = courseProgress(item, progressByCourse[id].progress);
                return <article className="resource-card" key={id}>
                  <div className="resource-card-top"><ResourceArt kind="course" /><span className="resource-type">CURSO {String(index + 1).padStart(2, "0")}</span><span className={`status-badge ${summary.status === "Completado" ? "complete" : ""}`}>{summary.status}</span></div>
                  <h2>{item.title}</h2><p className="resource-description">{item.description}</p>
                  <div className="resource-meta"><span>{item.topics.length} temas</span><span>{summary.total} ejercicios</span></div>
                  <div className="card-progress"><p>{summary.percentage}% · {summary.approved} / {summary.total} ejercicios aprobados</p><progress aria-label={`Progreso de ${item.title}`} value={summary.approved} max={summary.total} /></div>
                  <div className="resource-actions"><button className="primary" aria-label={`${resumeLabel(item, progressByCourse[id].progress)} ${item.title}`} onClick={() => startCourse(item)}>{resumeLabel(item, progressByCourse[id].progress)} <Icon name="arrow" /></button><button className="secondary" aria-label={`Ver temas de ${item.title}`} onClick={() => navigate({ screen: "topics", courseId: id, topicId: null })}>Ver temas</button></div>
                </article>;
              })}
            </div>
          </main>
        )}
        {view === "topics" && (
          <main className="courses catalog-page">
            <header className="course-overview"><ResourceArt kind="course" /><div><div className="eyebrow">TU CURSO</div><h1>{course.title}</h1><p>{course.description}</p><span className="status-badge">{currentProgress.status}</span></div><button className="primary" onClick={() => startCourse(course)}>{resumeLabel(course, state.progress)} curso <Icon name="arrow" /></button></header>
            <div className="course-progress-overview"><p>{currentProgress.percentage}% · {currentProgress.approved} / {currentProgress.total} ejercicios aprobados</p><progress aria-label="Progreso del curso" value={currentProgress.approved} max={currentProgress.total} /></div>
            <div className="catalog-section-heading"><h2>Temas del curso</h2><span>{course.topics.length} temas · Sin desbloqueos</span></div>
            <div className="topic-list">
              {course.topics.map((item, index) => {
                const approved = item.exercises.filter(e => completed.includes(e.id)).length;
                return <article className="topic-row" key={item.id}>
                  <span className="topic-number">{String(index + 1).padStart(2, "0")}</span><ResourceArt kind="topic" />
                  <div className="topic-row-content"><h3>{item.title}</h3><p>{item.summary}</p><div className="resource-meta"><span>{approved} / {item.exercises.length} ejercicios aprobados</span>{item.duration && <span>{item.duration}</span>}</div></div>
                  {approved === item.exercises.length && <span className="topic-done"><Icon name="check" />Completado</span>}
                  <button className="secondary" aria-label={`${String(index + 1).padStart(2, "0")} ${item.title}`} onClick={() => openTopic(course, item)}>Abrir tema <Icon name="arrow" /></button>
                </article>;
              })}
            </div>
            {course.assessment && <section className="course-assessment-link"><Icon name="check" /><div><h3>Evaluación final</h3><p>Opcional. Comprueba lo aprendido cuando quieras.</p></div><button className="secondary" onClick={() => navigate({ screen: "assessment" })}>{assessmentResult ? "Ver evaluación final" : "Comenzar evaluación final"}</button></section>}
          </main>
        )}
        {(view === "learn" || view === "assessment") && (
          <main className="learning">
            <div className="lesson-heading">
              <div>
                <button
                  className="text-button"
                  onClick={() => navigate({ screen: "topics" })}
                >
                  Volver a temas
                </button>
                <div className="eyebrow">{course.title.toUpperCase()}</div>
                <h1>{view === "assessment" ? "Evaluación del curso" : `Tema ${String(course.topics.indexOf(topic) + 1).padStart(2, "0")} · ${topic.title}`}</h1>
              </div>
              <div className="route-progress">
                <span>
                  {currentProgress.approved} / {currentProgress.total} ejercicios
                </span>
                <progress value={currentProgress.approved} max={currentProgress.total} />
              </div>
            </div>
            {view === "assessment" ? (
              <FinalAssessment
                course={course}
                result={assessmentResult}
                onResult={(assessmentResult) =>
                  updateProgress(course.id, { assessmentResult })
                }
                onBack={() => navigate({ screen: "learn" })}
              />
            ) : (
              <>
                <div className="topic-strip" aria-label="Temas del curso">
                  {course.topics.map((item, index) => (
                    <button
                      className={
                        topic.id === item.id
                          ? "topic-chip selected"
                          : "topic-chip"
                      }
                      key={item.id}
                      aria-current={topic.id === item.id ? "step" : undefined}
                      onClick={() => openTopic(course, item)}
                    >
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      {item.title}
                      {item.exercises.every((exercise) =>
                        completed.includes(exercise.id),
                      ) && <span className="topic-completed">Completado</span>}
                    </button>
                  ))}
                </div>
                <LearningWorkspace
                  course={course}
                  key={`${course.id}:${topic.id}:${workspaceVersion}`}
                  topic={topic}
                  completed={completed}
                  onComplete={(id) =>
                    updateProgress(course.id, {
                      completed: completed.includes(id)
                        ? completed
                        : [...completed, id],
                    })
                  }
                  access={access}
                  conversation={conversation}
                  learningTab={learningTab}
                  setLearningTab={setLearningTab}
                  onConfigure={() => setSettingsOpen(true)}
                />
                {course.assessment && (
                  <section className="assessment-invite">
                    <span>Evaluación final <span className="muted">· Opcional, independiente del avance</span></span>
                    <button
                      className="secondary"
                      onClick={() => navigate({ screen: "assessment" })}
                    >
                      {assessmentResult
                        ? "Ver evaluación final"
                        : "Comenzar evaluación final"}
                      <Icon name="arrow" />
                    </button>
                  </section>
                )}
                <button
                  className="primary"
                  onClick={() => {
                    const index = course.topics.indexOf(topic);
                    if (index < course.topics.length - 1)
                      openTopic(course, course.topics[index + 1]);
                    else navigate({ screen: "topics" });
                  }}
                >
                  {topic === course.topics.at(-1)
                    ? "Volver a temas"
                    : "Siguiente tema"}
                </button>
              </>
            )}
          </main>
        )}
        <section className="progress-controls learning-data" aria-label="Progreso guardado">
          <div className="progress-summary">
            <p>Progreso y conversaciones de este navegador.</p>
            {course && (
              <button
                ref={resetButton}
                className="secondary"
                onClick={() => setConfirmReset("course")}
              >
                Reiniciar este curso
              </button>
            )}
            <button className="secondary" onClick={() => setConfirmReset("all")}>
              Reiniciar todo el aprendizaje
            </button>
          </div>
          {confirmReset && (
            <div
              className="reset-confirmation"
              role="group"
              aria-label="Confirmar reinicio"
            >
              <p>
                {confirmReset === "all"
                  ? "¿Reiniciar todo el aprendizaje de todos los cursos, incluidos los retirados del catálogo?"
                  : `¿Reiniciar «${course.title}»? El curso se reinicia en todas sus rutas.`}
                {" "}Se borrarán todas las aprobaciones, incluidas las de ejercicios
                retirados, el resultado de la evaluación final, todas las conversaciones
                del tutor (preguntas, respuestas, parciales y capturas), la posición
                y las copias de recuperación del ámbito elegido. Se detendrá la respuesta
                activa afectada. Se conserva la Configuración del tutor (clave, modelo
                y su condición de persistencia) y el catálogo descargado.
              </p>
              <button
                className="secondary"
                autoFocus
                onClick={() => {
                  setConfirmReset(false);
                  resetButton.current?.focus();
                }}
              >
                Cancelar
              </button>
              <button className="primary" onClick={resetProgress}>
                Sí, reiniciar
              </button>
            </div>
          )}
        </section>
      </div>
      {settingsOpen && (
        <TutorSettings
          access={access}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => {
            focusTutorAfterSettings.current = true;
            setSettingsOpen(false);
            setLearningTab("tutor");
            if (course && view !== "learn") startCourse(course);
          }}
        />
      )}
    </div>
  );
}

function LearningWorkspace({
  course,
  topic,
  completed,
  onComplete,
  access,
  conversation,
  learningTab,
  setLearningTab,
  onConfigure,
}) {
  useEffect(() => () => conversation.cancel(), [conversation]);
  const execution = useRef(null);
  const [lastResult, setLastResult] = useState(null);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const exercise = topic.exercises[exerciseIndex];
  const [code, setCode] = useState(exercise.starter);
  const [hintCount, setHintCount] = useState(0);
  const [result, setResult] = useState(null);
  const [feedback, setFeedback] = useState("");
  const python = usePython((received) => {
    setResult(received);
    if (execution.current)
      setLastResult({
        ...execution.current,
        output: received.output || "",
        error: received.error || null,
      });
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
        <div
          role="tablist"
          aria-label="Panel de aprendizaje"
          className="learning-tabs"
        >
          {[
            ["lesson", "Lección"],
            ["tutor", "Tutor"],
          ].map(([id, label]) => (
            <button
              key={id}
              id={`${id}-tab`}
              role="tab"
              aria-selected={learningTab === id}
              aria-controls={`${id}-panel`}
              tabIndex={learningTab === id ? 0 : -1}
              onClick={() => setLearningTab(id)}
              onKeyDown={(event) => {
                if (
                  ["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)
                ) {
                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? "lesson"
                      : event.key === "End"
                        ? "tutor"
                        : id === "lesson"
                          ? "tutor"
                          : "lesson";
                  setLearningTab(next);
                  document.getElementById(`${next}-tab`).focus();
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id="lesson-panel"
          aria-labelledby="lesson-tab"
          hidden={learningTab !== "lesson"}
        >
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
        </div>
        <div
          role="tabpanel"
          id="tutor-panel"
          aria-labelledby="tutor-tab"
          hidden={learningTab !== "tutor"}
        >
          <TutorPanel
            onConfigure={onConfigure}
            access={access}
            conversation={conversation}
            courseId={course.id}
            topicId={topic.id}
            topicTitle={topic.title}
            capture={() =>
              captureContext({
                course,
                topic,
                exercise,
                draft: code,
                lastResult,
              })
            }
          />
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
                  execution.current = { exerciseId: exercise.id, code };
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

function FinalAssessment({ course, result, onResult, onBack }) {
  const assessmentQuestions = course.assessment.questions;
  const [answers, setAnswers] = useState(result?.answers || {});
  const resultHeading = useRef(null);
  useEffect(() => {
    if (result) resultHeading.current?.focus();
  }, [result]);
  function submit(event) {
    event.preventDefault();
    if (!assessmentQuestions.every((question) => answers[question.id])) return;
    onResult(assessAnswers(assessmentQuestions, answers));
  }
  return (
    <section className="assessment panel">
      <div className="lesson-content">
        <div className="eyebrow">EVALUACIÓN OPCIONAL DEL CURSO</div>
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
                {index + 1}. {question.prompt}
              </legend>
              <p>{question.prompt}</p>
              {question.code && (
                <pre className="example">
                  <code>{question.code}</code>
                </pre>
              )}
              <div className="assessment-options">
                {question.options.map((option) => (
                  <label key={option.id}>
                    <input
                      type="radio"
                      name={question.id}
                      value={option.id}
                      checked={answers[question.id] === option.id}
                      onChange={() =>
                        setAnswers({ ...answers, [question.id]: option.id })
                      }
                      required
                    />
                    {option.text}
                  </label>
                ))}
              </div>
              {result && (
                <div
                  className={`answer-explanation ${result.answers[question.id] === question.answerId ? "correct" : "incorrect"}`}
                >
                  <strong>
                    {result.answers[question.id] === question.answerId
                      ? "¡Correcto!"
                      : `Respuesta correcta: ${question.options.find((option) => option.id === question.answerId).text}`}
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
