import React from "react";
import { ExerciseWorkspace } from "./ExerciseWorkspace.jsx";

export function Practice({
  round,
  saved,
  onChange,
  onNewRound,
  onCourses,
  onConfigure,
  tutorConfigured,
}) {
  const resolved = round.entries.filter(
    (entry) => entry.status === "resolved",
  ).length;
  const complete =
    round.entries.length > 0 && resolved === round.entries.length;
  const current = round.entries.find((entry) => entry.id === round.currentId);
  function updateEntry(id, patch) {
    onChange((previous) => ({
      ...previous,
      entries: previous.entries.map((entry) =>
        entry.id === id ? { ...entry, ...patch(entry) } : entry,
      ),
    }));
  }
  return (
    <main className="practice-page">
      <header className="practice-heading">
        <div>
          <span className="eyebrow">APRENDE HACIENDO</span>
          <h1>Práctica</h1>
          <p>Una ronda a tu ritmo. Tu progreso de curso es independiente.</p>
          <span className="muted">
            Revisión del catálogo: {round.revision} ·{" "}
            {saved ? "Ronda guardada" : "Ronda en esta sesión"}
          </span>
        </div>
        {current && (
          <button className="secondary" onClick={onNewRound}>
            Nueva ronda
          </button>
        )}
      </header>
      {!current ? (
        <section className="practice-state panel">
          <h2>Aún no hay ejercicios para practicar</h2>
          <p>Explora los cursos disponibles para seguir aprendiendo.</p>
          <button className="primary" onClick={onCourses}>
            Ir a Cursos
          </button>
        </section>
      ) : (
        <>
          <div className="round-progress">
            <strong>
              {resolved} de {round.entries.length} resueltos
            </strong>
            <progress
              aria-label="Progreso de la ronda"
              value={resolved}
              max={round.entries.length}
            />
          </div>
          {complete && !round.reviewing ? (
            <section className="practice-state panel">
              <span className="eyebrow">¡BUEN TRABAJO!</span>
              <h2>Ronda completada</h2>
              <p>Tu ronda permanece disponible para revisar tus respuestas.</p>
              <button
                className="primary"
                onClick={() =>
                  onChange((previous) => ({ ...previous, reviewing: true }))
                }
              >
                Revisar ejercicios
              </button>
            </section>
          ) : (
            <div className="practice-grid">
              <nav
                className="practice-rail"
                aria-label="Ejercicios de la ronda"
              >
                <h2>Tu ronda</h2>
                {round.entries.map((entry, index) => (
                  <button
                    key={entry.id}
                    className={`round-exercise ${entry.id === current.id ? "selected" : ""} ${entry.status === "resolved" ? "resolved" : ""}`}
                    aria-current={entry.id === current.id ? "step" : undefined}
                    onClick={() =>
                      onChange((previous) => ({
                        ...previous,
                        currentId: entry.id,
                      }))
                    }
                  >
                    <span className="round-step">
                      {entry.status === "resolved" ? "✓" : index + 1}
                    </span>
                    <span>
                      <strong>{entry.exercise.title}</strong>
                      <small>
                        {entry.exercise.type === "choice"
                          ? "Selección"
                          : "Código"}{" "}
                        · {entry.topic.title}
                      </small>
                      <small>
                        {entry.status === "resolved"
                          ? "Resuelto"
                          : entry.status === "in-progress"
                            ? "En progreso"
                            : "Pendiente"}
                      </small>
                    </span>
                  </button>
                ))}
              </nav>
              <section
                className="practice-workspace"
                aria-label="Ejercicio de la ronda"
              >
                <div className="practice-context">
                  <strong>{current.topic.title}</strong>
                  <span>{current.course.title}</span>
                </div>
                <ExerciseWorkspace
                  key={`${round.id}:${current.id}`}
                  exercise={current.exercise}
                  state={current.work}
                  approved={current.status === "resolved"}
                  label={
                    current.exercise.type === "choice"
                      ? "EJERCICIO DE SELECCIÓN"
                      : "EJERCICIO DE CÓDIGO"
                  }
                  onStateChange={(work) =>
                    updateEntry(current.id, (entry) => ({
                      work,
                      status:
                        entry.status === "resolved"
                          ? "resolved"
                          : "in-progress",
                    }))
                  }
                  onComplete={() =>
                    updateEntry(current.id, () => ({ status: "resolved" }))
                  }
                />
                {!tutorConfigured && (
                  <aside className="practice-tutor-notice">
                    <p>El tutor no está configurado.</p>
                    <p>
                      Puedes resolver los ejercicios y consultar las pistas.
                    </p>
                    <button className="text-button" onClick={onConfigure}>
                      Configurar tutor
                    </button>
                  </aside>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </main>
  );
}
