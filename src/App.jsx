import SvgWalkthrough from "./SvgWalkthrough.jsx";
import DecisionWalkthrough from "./DecisionWalkthrough.jsx";
import { visibleWalkthrough } from "./walkthroughState.js";
import { learnerTransaction, inspectLegacyConflict, preserveLegacyConflict, readLegacyRecoveries } from "./learnerStore.js";
import { removeHistory, historyChanged, storedCourseIds } from "./tutorHistory.js";
import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { assessAnswers, assessmentReview } from "./assessment.js";
import {
  emptyProgress,
  courseProgress,
  resumeLabel,
  loadProgress,
  saveProgress,
  progressChanged,
  anyProgressChanged,
  rememberProgressRecords,
} from "./progress.js";
import { resetLearner } from "./learnerReset.js";
import { useTutorAccess } from "./tutorAccess.js";
import { TutorPanel, TutorSettings } from "./TutorAccess.jsx";
import { createConversationService } from "./tutorConversation.js";
import { captureContext } from "./tutorContext.js";
import { Icon } from "./Icon.jsx";
import { ExerciseWorkspace } from "./ExerciseWorkspace.jsx";
import { Practice } from "./Practice.jsx";
import { PersonalGenerator } from "./PersonalGenerator.jsx";
import { PracticeTutor } from "./PracticeTutor.jsx";
import { createPracticeRound } from "./practiceRound.js";
import { loadPractice, savePractice } from "./practiceStorage.js";

import pathArt from "./assets/resources/path.svg";
import courseArt from "./assets/resources/course.svg";
import topicArt from "./assets/resources/topic.svg";

function ResourceArt({ kind, icon, iconFiles }) {
  const source = icon && iconFiles?.[icon.file];
  return (
    <span className={`resource-art resource-art-${kind}`} aria-hidden="true">
      <img
        src={
          source
            ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`
            : { path: pathArt, course: courseArt, topic: topicArt }[kind]
        }
        alt=""
      />
    </span>
  );
}

// Only a trusted composition may supply personal execution configuration.
// A personal identity without it fails closed; it must never use original checks.
function personalExecution(courseId, exercise, resolve) {
  if (exercise.type === "choice") return undefined;
  let identity;
  try { identity = JSON.parse(courseId); } catch { return undefined; }
  if (!Array.isArray(identity) || identity[0] !== "personal") return undefined;
  return resolve?.(courseId, exercise) || {};
}

export default function App({ publication, onPersonalIncorporated, personalExecutionFor }) {
  const { catalog, courses } = publication;
  const [legacyConflict, setLegacyConflict] = useState(inspectLegacyConflict);
  const [legacyError, setLegacyError] = useState("");
  const [legacyNeedsReview, setLegacyNeedsReview] = useState(false);
  const legacyConflictRef = useRef(legacyConflict);
  const legacyDetails = useRef(null);
  const [legacyRecoveries, setLegacyRecoveries] = useState(readLegacyRecoveries);
  useEffect(() => {
    const refresh = () => {
      const next = inspectLegacyConflict();
      const previous = legacyConflictRef.current;
      if (previous && next && (previous.raw !== next.raw || JSON.stringify(previous.after) !== JSON.stringify(next.after)))
        setLegacyNeedsReview(true);
      legacyConflictRef.current = next;
      setLegacyConflict(next);
      setLegacyRecoveries(readLegacyRecoveries());
    };
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);
  function readSessionSnapshot() {
    return {
      ...sessionRef.current,
      conversations: conversation.getSnapshot().exchanges,
      recoveredConversations: conversation.getSnapshot().recoveredExchanges,
      drafts: [...document.querySelectorAll("textarea")].map((element) => ({
        label: element.getAttribute("aria-label") || element.closest("label")?.textContent || "Borrador",
        value: element.value,
      })),
    };
  }
  async function resolveLegacyConflict(useLegacy = false) {
    try {
      const result = await preserveLegacyConflict(legacyConflict, readSessionSnapshot, useLegacy);
      if (result === "conflict") {
        const next = inspectLegacyConflict();
        legacyConflictRef.current = next;
        setLegacyConflict(next);
        setLegacyNeedsReview(true);
        setLegacyError("Los datos volvieron a cambiar. Revisa las versiones actualizadas antes de continuar.");
      } else window.location.reload();
    } catch {
      setLegacyError("No se pudieron conservar ambas versiones. Los datos originales siguen intactos; vuelve a intentarlo cuando el almacenamiento esté disponible.");
    }
  }
  const [conversation] = useState(createConversationService);
  const recoveryWarning = useSyncExternalStore(
    conversation.subscribe,
    () => conversation.getSnapshot().recoveryWarning,
  );
  const access = useTutorAccess({ beforeApply: conversation.cancel });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [practiceRecovery] = useState(() => loadPractice(publication));
  const [practiceRound, setPracticeRound] = useState(practiceRecovery.round);
  const [practiceStorageAvailable, setPracticeStorageAvailable] = useState(
    practiceRecovery.storageAvailable,
  );
  const [practiceSaved, setPracticeSaved] = useState(false);
  const [practiceConflict, setPracticeConflict] = useState("");
  const [pendingPractice, setPendingPractice] = useState(null);
  const [reviewingPractice, setReviewingPractice] = useState(false);
  const applyingPractice = useRef(false);
  useEffect(() => {
    if (!practiceRound || !practiceStorageAvailable || reviewingPractice) return;
    let cancelled = false;
    setPracticeSaved(false);
    if (!navigator.locks) { setPracticeStorageAvailable(false); return; }
    navigator.locks.request("python-tutor:learner", () => {
      if (cancelled) return;
      const saved = savePractice(practiceRound);
      if (saved === "conflict") {
        const latest = loadPractice(publication);
        setPendingPractice(practiceRound);
        applyingPractice.current = false;
        setPracticeRound(latest.round);
        setPracticeConflict("La ronda cambió en otra pestaña. Se recargó la versión guardada; revisa la operación antes de intentarla de nuevo.");
      } else {
        setPracticeSaved(saved);
        if (saved && applyingPractice.current) {
          applyingPractice.current = false;
          setPendingPractice(null);
          setPracticeConflict("");
        }
        if (!saved) setPracticeStorageAvailable(false);
      }
    }).catch(() => {
      if (!cancelled) setPracticeStorageAvailable(false);
    });
    return () => { cancelled = true; };
  }, [practiceRound, practiceStorageAvailable, reviewingPractice]);
  const [learningTab, setLearningTab] = useState("lesson");
  const topicSessions = useRef(new Map());
  const focusTutorAfterSettings = useRef(false);
  const rootLocation = {
    screen: "paths",
    pathId: null,
    courseId: null,
    topicId: null,
  };
  const [location, setLocation] = useState(rootLocation);
  const [progressByCourse, setProgressByCourse] = useState(() => {
    rememberProgressRecords();
    return Object.fromEntries(
      Object.values(courses).map((course) => [course.id, loadProgress(course)]),
    );
  });
  const [confirmReset, setConfirmReset] = useState(false);
  const [workspaceVersion, setWorkspaceVersion] = useState(0);
  const resetButton = useRef(null);
  const [resetError, setResetError] = useState("");
  const [resumeNotice, setResumeNotice] = useState("");
  useEffect(() => {
    history.replaceState(rootLocation, "");
    const onBack = (event) => {
      setResumeNotice("");
      setLocation(event.state?.screen ? event.state : rootLocation);
    };
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, []);
  useEffect(() => {
    if (!settingsOpen && focusTutorAfterSettings.current) {
      focusTutorAfterSettings.current = false;
      if (location.screen === "practice")
        document.querySelector(".practice-tutor textarea")?.focus();
      else document.querySelector(".topic-tutor-dock textarea")?.focus();
    }
  }, [settingsOpen]);
  function navigate(next) {
    if (next.screen === "practice")
      setPracticeRound((round) => round || createPracticeRound(publication));
    setConfirmReset(false);
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
  const assessmentResult = assessmentReview(
    course?.assessment?.questions,
    state?.progress.assessmentResult,
  );
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
  const [pendingProgress, setPendingProgress] = useState(null);
  const progressRef = useRef(progressByCourse);
  progressRef.current = progressByCourse;
  const sessionRef = useRef(null);
  sessionRef.current = { progressByCourse, pendingProgress, pendingPractice, reviewingPractice, practiceRound };
  async function updateProgress(id, change) {
    const apply = () => {
      const previous = progressRef.current;
      const progress = { ...previous[id].progress, ...change };
      const saved = saveProgress(courses[id], progress);
      if (saved === "conflict") setPendingProgress({ id, change });
      const latest = saved === "conflict" ? loadProgress(courses[id]) : null;
      const next = saved === "conflict"
        ? { ...latest, message: [latest.message, "El progreso cambió en otra pestaña. Se recargó la versión guardada; revisa la operación antes de intentarla de nuevo."].filter(Boolean).join(" ") }
        : { progress, message: saved ? previous[id].message.replace("El progreso cambió en otra pestaña. Se recargó la versión guardada; revisa la operación antes de intentarla de nuevo.", "").trim() : [previous[id].message, previous[id].message.includes("No se pudo guardar el progreso") ? "" : "No se pudo guardar el progreso en este navegador. Tu avance solo está disponible en esta sesión."].filter(Boolean).join(" ") };
      progressRef.current = { ...previous, [id]: next };
      setProgressByCourse(progressRef.current);
    };
    const sessionOnly = () => setProgressByCourse((previous) => ({ ...previous, [id]: { progress: { ...previous[id].progress, ...change }, message: "No se pudo guardar el progreso: este navegador no permite protegerlo entre pestañas. Tu avance solo está disponible en esta sesión." } }));
    if (!navigator.locks) { sessionOnly(); return; }
    try { await navigator.locks.request("python-tutor:learner", apply); }
    catch { sessionOnly(); }
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
    const destination =
      previous ||
      (retired &&
        selectedCourse.topics.find((item) =>
          item.exercises.some(
            (exercise) => !progress.completed.includes(exercise.id),
          ),
        )) ||
      selectedCourse.topics[0];
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
  async function resetProgress() {
    const global = confirmReset === "all";
    conversation.cancel();
    if (!navigator.locks) {
      setResetError("No se pudo proteger el reinicio entre pestañas; no se modificaron los datos guardados.");
      return;
    }
    await navigator.locks.request("python-tutor:learner", () => {
      try {
        const ids = global ? [...new Set([...Object.keys(progressRef.current), ...storedCourseIds()])] : [course.id];
        if ((global ? anyProgressChanged() : progressChanged(ids)) || historyChanged(ids)) {
          rememberProgressRecords();
          const latest = Object.fromEntries(Object.values(courses).map((item) => [item.id, loadProgress(item)]));
          progressRef.current = latest;
          setProgressByCourse(latest);
          conversation.reload();
          setResetError("Los datos cambiaron en otra pestaña. Se recargó la versión guardada; revisa el reinicio antes de intentarlo de nuevo.");
          return;
        }
        const { cleared, warning } = learnerTransaction(() => resetLearner({
          all: global,
          courseId: global ? undefined : course.id,
          progressByCourse: progressRef.current,
          courses,
          conversation: { reset: removeHistory },
        }));
        conversation.reload({ clearRecovered: global ? true : course.id });
        setLegacyRecoveries(readLegacyRecoveries());
        setProgressByCourse((previous) => ({ ...previous, ...cleared }));
        setResetError(warning);
        navigate(global ? rootLocation : { screen: "topics", topicId: null });
        setWorkspaceVersion((value) => value + 1);
        setConfirmReset(false);
        resetButton.current?.focus();
      } catch {
        setResetError("No se pudo guardar el reinicio. Se conserva la última versión guardada; vuelve a intentarlo.");
      }
    }).catch(() => setResetError("No se pudo proteger el reinicio entre pestañas; no se modificaron los datos guardados."));
  }
  const currentProgress = course
    ? courseProgress(course, state.progress)
    : null;
  return (
    <div className={`app-shell ${view === "practice" ? "practice-shell" : ""}`}>
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
          <button
            className={`nav ${view === "practice" ? "active" : ""}`}
            aria-current={view === "practice" ? "page" : undefined}
            onClick={() =>
              navigate({
                screen: "practice",
                pathId: null,
                courseId: null,
                topicId: null,
              })
            }
          >
            <Icon name="code" />
            Práctica
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
        <nav
          className="learning-breadcrumbs"
          aria-label="Contexto de aprendizaje"
        >
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
      {legacyConflict && (
        <section className="storage-warning legacy-conflict" role="region" aria-label="Revisar datos de otra versión">
          <p>Otra versión de la aplicación cambió datos de aprendizaje. Revisa ambas versiones antes de continuar guardando.</p>
          <details ref={legacyDetails}>
            <summary>Ver versiones disponibles</summary>
            <p>Versión actual de este navegador:</p>
            <pre>{JSON.stringify(legacyConflict.records, null, 2)}</pre>
            <p>Datos anteriores y cambios de la otra versión:</p>
            <pre>{JSON.stringify({ anterior: legacyConflict.before, otraVersion: legacyConflict.after }, null, 2)}</pre>
          </details>
          <button className="secondary" onClick={() => {
            const data = JSON.stringify({ version: 1, current: legacyConflict.records, legacyBefore: legacyConflict.before, legacyAfter: legacyConflict.after, session: readSessionSnapshot() }, null, 2);
            const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
            const link = document.createElement("a");
            link.href = url;
            link.download = "python-tutor-recuperacion.json";
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 0);
          }}>Descargar ambas versiones</button>
          <p>Puedes mantener la versión actual o usar los cambios de la otra versión. La versión que no elijas y el trabajo de esta sesión se conservarán como copias de recuperación antes de recargar.</p>
          {legacyNeedsReview && <button className="secondary" onClick={() => {
            setLegacyNeedsReview(false);
            setLegacyError("");
            if (legacyDetails.current) legacyDetails.current.open = true;
          }}>Revisar datos actualizados</button>}
          <button className="secondary" disabled={legacyNeedsReview} onClick={() => resolveLegacyConflict(false)}>Conservar ambas versiones</button>
          <button className="secondary" disabled={legacyNeedsReview} onClick={() => resolveLegacyConflict(true)}>Usar datos de otra versión</button>
          {legacyError && <p role="alert">{legacyError}</p>}
        </section>
      )}
      {legacyRecoveries.length > 0 && (
        <details className="storage-warning legacy-conflict" aria-label="Copias de datos de otra versión">
          <summary>Copias de datos de otra versión</summary>
          <p>Estas copias conservan los datos anteriores y los cambios detectados. Puedes descargarlas para recuperarlos.</p>
          <pre>{legacyRecoveries.map((item) => item.raw).join("\n")}</pre>
          <button className="secondary" onClick={() => {
            const url = URL.createObjectURL(new Blob([JSON.stringify(legacyRecoveries, null, 2)], { type: "application/json" }));
            const link = document.createElement("a");
            link.href = url;
            link.download = "python-tutor-copias-recuperacion.json";
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 0);
          }}>Descargar copias de recuperación</button>
        </details>
      )}
        {recoveryWarning && (
          <p className="storage-warning" role="alert">
            {recoveryWarning}
          </p>
        )}
        {resumeNotice && (
          <p className="storage-warning" role="alert">
            {resumeNotice}
          </p>
        )}
        {(resetError || storageMessage) && (
          <p className="storage-warning learning-notice" role="alert">
            {resetError || storageMessage}
          </p>
        )}
        {pendingProgress && (
          <div className="storage-warning learning-notice">
            <p>
              Cambio pendiente en {courses[pendingProgress.id]?.title}: {pendingProgress.change.topicId
                ? `continuar en ${courses[pendingProgress.id]?.topics.find((item) => item.id === pendingProgress.change.topicId)?.title || "el tema seleccionado"}`
                : pendingProgress.change.completed
                  ? "actualizar los ejercicios completados"
                  : "actualizar el resultado de la evaluación"}.
            </p>
            <button className="secondary" onClick={() => {
              const { id, change } = pendingProgress;
              const completed = change.completed
                ? [...new Set([...progressRef.current[id].progress.completed, ...change.completed])]
                : undefined;
              setPendingProgress(null);
              updateProgress(id, completed ? { ...change, completed } : change);
            }}>Aplicar cambio revisado</button>
            <button className="secondary" onClick={() => setPendingProgress(null)}>Descartar cambio</button>
          </div>
        )}
        {view === "practice" && practiceRound && (
          <Practice
            personalExecutionFor={(entry) => personalExecution(entry.course.id, entry.exercise, personalExecutionFor)}
            round={practiceRound}
            saved={practiceSaved && practiceStorageAvailable}
            notice={[practiceConflict, practiceRecovery.notice, practiceRecovery.recoveryWarning].filter(Boolean).join(" ")} 
            pendingChanges={!!pendingPractice}
            reviewingChanges={reviewingPractice}
            onReviewChanges={() => {
              setPracticeSaved(false);
              setReviewingPractice(true);
              setPracticeRound(pendingPractice);
            }}
            onDiscardChanges={() => {
              const latest = loadPractice(publication);
              setPendingPractice(null);
              setPracticeConflict("");
              setReviewingPractice(false);
              setPracticeRound(latest.round);
            }}
            onApplyChanges={() => {
              applyingPractice.current = true;
              setReviewingPractice(false);
            }}
            storageAvailable={practiceStorageAvailable}
            onChange={(change) => { setPracticeSaved(false); setPracticeRound(change); }}
            onNewRound={() => {
              setPracticeSaved(false);
              setPracticeRound(createPracticeRound(publication));
            }}
            onCourses={() => navigate(rootLocation)}
            renderTutor={(entry, onClose) => (
              <PracticeTutor
                entry={entry}
                onClose={onClose}
                access={access}
                conversation={conversation}
                onConfigure={() => setSettingsOpen(true)}
              />
            )}
          />
        )}
        {import.meta.env.DEV && <div hidden={view !== "personal-generator"}><PersonalGenerator onConfigure={() => setSettingsOpen(true)} visible={view === "personal-generator"} publication={publication} onIncorporated={onPersonalIncorporated} access={access} onClose={() => navigate(rootLocation)} /></div>}
        {view === "paths" && (
          <main className="courses catalog-page">
            <header className="catalog-heading">
              <div className="eyebrow">TU PRÓXIMO PASO</div>
              <h1>Cursos y rutas de aprendizaje</h1>
              <p className="page-subtitle">
                Elige un objetivo y aprende a tu ritmo, practicando desde el
                primer tema.
              </p>
              <span className="catalog-count">
                {catalog.learningPaths.length} rutas disponibles · Acceso libre
                a todos los temas
              </span>
            </header>
            {import.meta.env.DEV && <button onClick={() => navigate({ screen: "personal-generator" })}>Crear ruta personal</button>}
            <div className="resource-grid">
              {catalog.learningPaths.map((item, index) => {
                const summaries = item.courseIds.map((id) =>
                  courseProgress(courses[id], progressByCourse[id].progress),
                );
                const status = summaries.every((s) => s.status === "Completado")
                  ? "Completado"
                  : summaries.some((s) => s.approved > 0)
                    ? "En progreso"
                    : "Sin iniciar";
                const done = summaries.filter(
                  (s) => s.status === "Completado",
                ).length;
                return (
                  <article className="resource-card path-card" key={item.id}>
                    <div className="resource-card-top">
                      <ResourceArt
                        kind="path"
                        icon={item.icon}
                        iconFiles={publication.iconFiles}
                      />
                      <span className="resource-type">
                        {item.personal ? "Personal" : `RUTA ${String(index + 1).padStart(2, "0")}`}
                      </span>
                      <span
                        className={`status-badge ${status === "Completado" ? "complete" : ""}`}
                      >
                        {status}
                      </span>
                    </div>
                    <h2>{item.title}</h2>
                    <p className="resource-description">{item.description}</p>
                    <div className="resource-meta">
                      <span>
                        {item.courseIds.length}{" "}
                        {item.courseIds.length === 1 ? "curso" : "cursos"}
                      </span>
                      <span>{done} completados</span>
                    </div>
                    <div className="path-course-preview">
                      {item.courseIds.map((id) => (
                        <span key={id}>
                          <Icon name="book" />
                          {courses[id].title}
                        </span>
                      ))}
                    </div>
                    <button
                      className="primary"
                      aria-label={`Explorar ${item.title}`}
                      onClick={() =>
                        navigate({
                          screen: "courses",
                          pathId: item.id,
                          courseId: null,
                          topicId: null,
                        })
                      }
                    >
                      Explorar ruta <Icon name="arrow" />
                    </button>
                  </article>
                );
              })}
            </div>
          </main>
        )}
        {view === "courses" && (
          <main className="courses catalog-page">
            <header className="catalog-heading">
              <div className="eyebrow">RUTA DE APRENDIZAJE</div>
              <h1>{path.title}</h1>
              <p>{path.description}</p>
              <span className="catalog-count">
                {path.courseIds.length}{" "}
                {path.courseIds.length === 1 ? "curso" : "cursos"} · Puedes
                comenzar por cualquiera
              </span>
            </header>
            <div className="resource-grid">
              {path.courseIds.map((id, index) => {
                const item = courses[id];
                const summary = courseProgress(
                  item,
                  progressByCourse[id].progress,
                );
                return (
                  <article className="resource-card" key={id}>
                    <div className="resource-card-top">
                      <ResourceArt
                        kind="course"
                        icon={item.icon}
                        iconFiles={publication.iconFiles}
                      />
                      <span className="resource-type">
                        CURSO {String(index + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={`status-badge ${summary.status === "Completado" ? "complete" : ""}`}
                      >
                        {summary.status}
                      </span>
                    </div>
                    <h2>{item.title}</h2>
                    {item.retiredOriginal && <span className="status-badge">Original retirado</span>}
                    <p className="resource-description">{item.description}</p>
                    <div className="resource-meta">
                      <span>{item.topics.length} temas</span>
                      <span>{summary.total} ejercicios</span>
                    </div>
                    <div className="card-progress">
                      <p>
                        {summary.percentage}% · {summary.approved} /{" "}
                        {summary.total} ejercicios aprobados
                      </p>
                      <progress
                        aria-label={`Progreso de ${item.title}`}
                        value={summary.approved}
                        max={summary.total}
                      />
                    </div>
                    <div className="resource-actions">
                      <button
                        className="primary"
                        aria-label={`${resumeLabel(item, progressByCourse[id].progress)} ${item.title}`}
                        onClick={() => startCourse(item)}
                      >
                        {resumeLabel(item, progressByCourse[id].progress)}{" "}
                        <Icon name="arrow" />
                      </button>
                      <button
                        className="secondary"
                        aria-label={`Ver temas de ${item.title}`}
                        onClick={() =>
                          navigate({
                            screen: "topics",
                            courseId: id,
                            topicId: null,
                          })
                        }
                      >
                        Ver temas
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </main>
        )}
        {view === "topics" && (
          <main className="courses catalog-page">
            <header className="course-overview">
              <ResourceArt
                kind="course"
                icon={course.icon}
                iconFiles={publication.iconFiles}
              />
              <div>
                <div className="eyebrow">TU CURSO</div>
                <h1>{course.title}</h1>
                <p>{course.description}</p>
                <span className="status-badge">{currentProgress.status}</span>
              </div>
              <button className="primary" onClick={() => startCourse(course)}>
                {resumeLabel(course, state.progress)} curso{" "}
                <Icon name="arrow" />
              </button>
            </header>
            <div className="course-progress-overview">
              <p>
                {currentProgress.percentage}% · {currentProgress.approved} /{" "}
                {currentProgress.total} ejercicios aprobados
              </p>
              <progress
                aria-label="Progreso del curso"
                value={currentProgress.approved}
                max={currentProgress.total}
              />
            </div>
            <div className="catalog-section-heading">
              <h2>Temas del curso</h2>
              <span>{course.topics.length} temas · Sin desbloqueos</span>
            </div>
            <div className="topic-list">
              {course.topics.map((item, index) => {
                const approved = item.exercises.filter((e) =>
                  completed.includes(e.id),
                ).length;
                return (
                  <article className="topic-row" key={item.id}>
                    <span className="topic-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <ResourceArt
                      kind="topic"
                      icon={item.icon}
                      iconFiles={publication.iconFiles}
                    />
                    <div className="topic-row-content">
                      <h3>{item.title}</h3>
                      <p>{item.summary}</p>
                      <div className="resource-meta">
                        <span>
                          {approved} / {item.exercises.length} ejercicios
                          aprobados
                        </span>
                        {item.duration && <span>{item.duration}</span>}
                      </div>
                    </div>
                    {approved === item.exercises.length && (
                      <span className="topic-done">
                        <Icon name="check" />
                        Completado
                      </span>
                    )}
                    <button
                      className="secondary"
                      aria-label={`${String(index + 1).padStart(2, "0")} ${item.title}`}
                      onClick={() => openTopic(course, item)}
                    >
                      Abrir tema <Icon name="arrow" />
                    </button>
                  </article>
                );
              })}
            </div>
            {course.assessment && (
              <section className="course-assessment-link">
                <Icon name="check" />
                <div>
                  <h3>Evaluación final</h3>
                  <p>Opcional. Comprueba lo aprendido cuando quieras.</p>
                </div>
                <button
                  className="secondary"
                  onClick={() => navigate({ screen: "assessment" })}
                >
                  {assessmentResult
                    ? "Ver evaluación final"
                    : "Comenzar evaluación final"}
                </button>
              </section>
            )}
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
                <h1>
                  {view === "assessment"
                    ? "Evaluación del curso"
                    : `Tema ${String(course.topics.indexOf(topic) + 1).padStart(2, "0")} · ${topic.title}`}
                </h1>
              </div>
              <div className="route-progress">
                <span>
                  {currentProgress.approved} / {currentProgress.total}{" "}
                  ejercicios
                </span>
                <progress
                  value={currentProgress.approved}
                  max={currentProgress.total}
                />
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
                  personalExecutionFor={(exercise) => personalExecution(course.id, exercise, personalExecutionFor)}
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
                  session={(() => {
                    const key = JSON.stringify([course.id, topic.id, workspaceVersion]);
                    if (!topicSessions.current.has(key)) topicSessions.current.set(key, { tab: "lesson", exerciseIndex: 0, exercises: {} });
                    return topicSessions.current.get(key);
                  })()}
                  learningTab={learningTab}
                  setLearningTab={setLearningTab}
                  tutorOpen={tutorOpen}
                  setTutorOpen={setTutorOpen}
                  onConfigure={() => setSettingsOpen(true)}
                />
                {course.assessment && (
                  <section className="assessment-invite">
                    <span>
                      Evaluación final{" "}
                      <span className="muted">
                        · Opcional, independiente del avance
                      </span>
                    </span>
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
        <section
          className="progress-controls learning-data"
          aria-label="Progreso y conversaciones"
        >
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
            <button
              className="secondary"
              onClick={() => setConfirmReset("all")}
            >
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
                  : `¿Reiniciar «${course.title}»? El curso se reinicia en todas sus rutas.`}{" "}
                Se borrarán todas las aprobaciones, incluidas las de ejercicios
                retirados, el resultado de la evaluación final, todas las
                conversaciones del tutor (preguntas, respuestas, parciales y
                capturas), la posición y las copias de recuperación del ámbito
                elegido. Se detendrá la respuesta activa afectada. Se conserva
                la Configuración del tutor (clave, modelo y su condición de
                persistencia) y el catálogo descargado.
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
            if (view === "learn") setTutorOpen(true);
            if (course && view !== "learn" && view !== "practice") startCourse(course);
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
  session,
  learningTab,
  setLearningTab,
  onConfigure,
  personalExecutionFor,
  tutorOpen,
  setTutorOpen,
}) {
  const [exerciseIndex, setExerciseIndexState] = useState(session.exerciseIndex);
  const [tab, setTabState] = useState(session.tab);
  const [, refreshExercise] = useState(0);
  const previousLearningTab = useRef(learningTab);
  const setTab = (value) => { session.tab = value; setTabState(value); setLearningTab(value); };
  const setExerciseIndex = (value) => { session.exerciseIndex = value; setExerciseIndexState(value); };
  useEffect(() => {
    if (previousLearningTab.current !== learningTab && learningTab === "tutor") setTutorOpen(true);
    previousLearningTab.current = learningTab;
  }, [learningTab]);
  const exercise = topic.exercises[exerciseIndex];
  const topicCompleted = topic.exercises.filter((item) =>
    completed.includes(item.id),
  ).length;
  return (
    <ExerciseWorkspace
      exercise={exercise}
      state={session.exercises[exercise.id] || { code: exercise.starter || "" }}
      onStateChange={(state) => { session.exercises[exercise.id] = state; refreshExercise((value) => value + 1); }}
      personalExecution={personalExecutionFor?.(exercise)}
      approved={completed.includes(exercise.id)}
      onComplete={onComplete}
      navigation={(isRunning) => (
        <>
          <div className="exercise-heading">
            <h2>Ahora te toca a ti</h2>
            <span>
              {topicCompleted} de {topic.exercises.length} ejercicios
              completados
            </span>
          </div>
          <nav className="exercise-tabs" aria-label="Ejercicios del tema">
            {topic.exercises.map((item, index) => (
              <button
                key={item.id}
                className={
                  exerciseIndex === index
                    ? "exercise-tab selected"
                    : "exercise-tab"
                }
                onClick={() => setExerciseIndex(index)}
                disabled={isRunning}
                aria-current={exerciseIndex === index ? "step" : undefined}
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
          </nav>
        </>
      )}
      label={`EJERCICIO ${exerciseIndex + 1}`}
    >
      {({ content, context }) => (
        <div className="topic-workspace">
            <div
              role="tablist"
              aria-label="Panel de aprendizaje"
              className="learning-tabs"
            >
              {[
                ["lesson", "Lección"],
                ["exercises", `Ejercicios (${topicCompleted}/${topic.exercises.length})`],
              ].map(([id, label]) => (
                <button
                  key={id}
                  id={`${id}-tab`}
                  role="tab"
                  aria-selected={tab === id}
                  aria-controls={`${id}-panel`}
                  tabIndex={tab === id ? 0 : -1}
                  onClick={() => setTab(id)}
                  onKeyDown={(event) => {
                    if (
                      ["ArrowRight", "ArrowLeft", "Home", "End"].includes(
                        event.key,
                      )
                    ) {
                      event.preventDefault();
                      const tabs = ["lesson", "exercises"];
                      const index = tabs.indexOf(id);
                      const next = event.key === "Home" ? tabs[0] : event.key === "End" ? tabs.at(-1) : tabs[(index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
                      setTab(next);
                      document.getElementById(`${next}-tab`).focus();
                    }
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          <section className="lesson-panel panel" hidden={tab !== "lesson"}>
            <div
              role="tabpanel"
              tabIndex={0}
              id="lesson-panel"
              aria-labelledby="lesson-tab"
              hidden={tab !== "lesson"}
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
                {!(topic.walkthrough?.type === "svg" && topic.walkthrough.code) && (
                  <pre className="example"><code>{topic.example}</code></pre>
                )}
                {topic.walkthrough?.type === "svg"
                  ? <SvgWalkthrough walkthrough={topic.walkthrough} example={topic.example} session={session} />
                  : topic.walkthrough && <DecisionWalkthrough walkthrough={topic.walkthrough} example={topic.example} session={session} />}
                <div className="takeaway">
                  <Icon name="bulb" />
                  <p>{topic.takeaway}</p>
                </div>
              </div>
            </div>
          </section>
          <div role="tabpanel" tabIndex={0} id="exercises-panel" aria-labelledby="exercises-tab" hidden={tab !== "exercises"}>{content}</div>
          <button className="tutor-launcher" onClick={() => setTutorOpen(true)} aria-expanded={tutorOpen} aria-controls="tutor-panel">Tutor IA</button>
          <TopicTutor open={tutorOpen} onClose={() => setTutorOpen(false)}>
            <TutorPanel
              onClose={() => setTutorOpen(false)}
              onConfigure={onConfigure}
              access={access}
              conversation={conversation}
              courseId={course.id}
              topicId={topic.id}
              topicTitle={topic.title}
              closeLabel="Cerrar Tutor"
              draftSession={session}
              capture={() => captureContext({ course, topic, ...(tab === "lesson" ? { walkthrough: topic.walkthrough && visibleWalkthrough(topic.walkthrough, topic.example, session.walkthrough) } : { exercise, ...context }) })}
            />
          </TopicTutor>
        </div>
      )}
    </ExerciseWorkspace>
  );
}

function TopicTutor({ open, onClose, children }) {
  const dialog = useRef(null);
  useEffect(() => {
    const node = dialog.current;
    if (open) {
      if (matchMedia("(max-width: 700px)").matches) node.showModal();
      else node.show();
      node.querySelector('[aria-label="Cerrar Tutor"]')?.focus();
    } else if (node.open) {
      node.close();
      document.querySelector('.tutor-launcher')?.focus();
    }
  }, [open]);
  return <dialog ref={dialog} id="tutor-panel" className="topic-tutor-dock" aria-label="Tutor IA" onKeyDown={(event) => {
    if (event.key === "Escape") { event.preventDefault(); onClose(); }
    if (event.key === "Tab" && matchMedia("(max-width: 700px)").matches) {
      const controls = [...dialog.current.querySelectorAll('button:not(:disabled), textarea:not(:disabled), input:not(:disabled), [tabindex="0"]')].filter((element) => element.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }} onCancel={(event) => { event.preventDefault(); onClose(); }}>{children}</dialog>;
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
