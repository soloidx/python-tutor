import React from "react";

// Historical snapshots contain visible content only: no checks, answer keys or
// authored hints are available for another attempt against an old publication.
export function ArchivedPracticeExercise({ entry }) {
  const { exercise, work } = entry;
  return (
    <section className="runner-column" aria-label="Revisión de práctica">
      <section className="practice-exercise panel">
        <span className="eyebrow">REVISIÓN · SOLO LECTURA</span>
        <h3>{exercise.title}</h3>
        <p>{exercise.prompt}</p>
      </section>
      {exercise.type === "choice" ? (
        <section className="choice-practice panel">
          {exercise.code && (
            <pre aria-label="Fragmento de código de solo lectura">
              <code>{exercise.code}</code>
            </pre>
          )}
          <fieldset disabled>
            <legend>Tu respuesta</legend>
            {exercise.options.map((option) => (
              <label className="choice-option" key={option.id}>
                <input
                  type="radio"
                  name={`archived-${exercise.id}`}
                  checked={work.selectedOptionId === option.id}
                  readOnly
                />
                <span>{option.text}</span>
              </label>
            ))}
          </fieldset>
          {work.selectionFeedback && (
            <div
              className={`feedback ${work.selectionResult?.correct ? "success" : "retry"}`}
              role="status"
            >
              {work.selectionFeedback}
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="editor-panel panel">
            <div className="editor-toolbar">main.py · Solo lectura</div>
            <div className="code-area">
              <textarea
                aria-label="Código Python"
                value={work.code ?? exercise.starter}
                readOnly
                spellCheck="false"
              />
            </div>
          </section>
          <section className="output-panel panel">
            <div className="panel-heading">
              <h3>Consola</h3>
            </div>
            <div className="console-body">
              <pre aria-label="Salida del programa">
                {work.result?.output || "Sin salida."}
              </pre>
              {work.result?.error && (
                <pre aria-label="Errores del programa">{work.result.error}</pre>
              )}
            </div>
          </section>
          {work.feedback && (
            <div
              className={`feedback ${work.result?.passed ? "success" : "retry"}`}
              role="status"
            >
              {work.feedback}
            </div>
          )}
        </>
      )}
    </section>
  );
}
