import React, { useRef, useState } from "react";
import { Icon } from "./Icon.jsx";
import { usePython } from "./usePython.js";

// Key the workspace by course + exercise identity when switching exercises.
// Its visible state is optional/controlled; completion never writes course progress.
export function ExerciseWorkspace({
  exercise,
  approved = false,
  onComplete = () => {},
  state,
  onStateChange,
  navigation,
  label = "EJERCICIO",
  children,
}) {
  const initialState = () => ({
    code: exercise.starter || "",
    hintCount: 0,
    result: null,
    feedback: "",
    lastCodeResult: null,
    selectedOptionId: null,
    selectionStatus: "none",
    selectionResult: null,
    selectionFeedback: null,
  });
  const [internalState, setInternalState] = useState(initialState);
  const activeExercise = useRef(exercise);
  const execution = useRef(null);
  let current = state ?? internalState;
  if (activeExercise.current !== exercise) {
    activeExercise.current = exercise;
    execution.current = null;
    if (state === undefined) {
      current = initialState();
      setInternalState(current);
    }
  }
  const stateRef = useRef(current);
  stateRef.current = current;
  const update = (patch) => {
    const next = { ...stateRef.current, ...patch };
    stateRef.current = next;
    if (state === undefined) setInternalState(next);
    onStateChange?.(next);
  };
  const {
    code = exercise.starter || "",
    hintCount = 0,
    result = null,
    feedback = "",
    lastCodeResult = null,
    selectedOptionId = null,
    selectionStatus = "none",
    selectionResult = null,
    selectionFeedback = null,
  } = current;
  const setCode = (code) => update({ code });
  const setHintCount = (hintCount) => update({ hintCount });
  const setResult = (result) => update({ result });
  const setFeedback = (feedback) => update({ feedback });
  const isChoice = exercise.type === "choice";
  const python = usePython((received) => {
    const lastCodeResult = execution.current
      ? {
          ...execution.current,
          output: received.output || "",
          error: received.error || null,
        }
      : null;
    update({
      result: received,
      lastCodeResult,
      feedback: received.passed
        ? `¡Correcto! ${exercise.success}`
        : received.error?.startsWith("Ejecución detenida")
          ? received.error
          : received.error
            ? "Revisa el error, corrige tu código y vuelve a ejecutar."
            : `Todavía no. ${exercise.retry}`,
    });
    if (received.passed) onComplete(execution.current.exerciseId);
  });
  function selectOption(selectedOptionId) {
    update({
      selectedOptionId,
      selectionStatus: "pending",
      selectionFeedback: null,
    });
  }
  function checkChoice() {
    const option = exercise.options.find(
      (item) => item.id === selectedOptionId,
    );
    if (!option) return;
    const correct = selectedOptionId === exercise.answerId;
    update({
      selectionResult: { optionId: selectedOptionId, correct },
      selectionStatus: "checked",
      selectionFeedback: correct
        ? exercise.explanation
        : option.retry || exercise.retry,
    });
    if (correct) onComplete(exercise.id);
  }
  const content = (
    <section className="runner-column" aria-label="Espacio de práctica">
      <section
        className="practice-exercise panel"
        aria-labelledby="practice-exercise-heading"
      >
        {navigation?.(python.status === "running")}
        <div className="exercise-prompt">
          <span className="eyebrow">{label}</span>
          <h3 id="practice-exercise-heading">{exercise.title}</h3>
          <p>{exercise.prompt}</p>
        </div>
        {exercise.hints.length > 0 && (
          <>
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
              <div className="hints" role="region" aria-label="Pistas">
                <strong>
                  Pista {hintCount} de {exercise.hints.length}
                </strong>
                {exercise.hints.slice(0, hintCount).map((hint) => (
                  <p key={hint}>{hint}</p>
                ))}
              </div>
            )}
          </>
        )}
      </section>
      {isChoice ? (
        <ChoicePractice
          exercise={exercise}
          selectedOptionId={selectedOptionId}
          selectionStatus={selectionStatus}
          selectionResult={selectionResult}
          feedback={selectionFeedback}
          approved={approved}
          onSelect={selectOption}
          onCheck={checkChoice}
        />
      ) : (
        <>
          <div className="editor-panel panel">
            <div className="editor-toolbar">
              <span className="file-tab">
                <Icon name="code" />
                main.py
              </span>
              <div className="editor-actions">
                {python.status === "running" && (
                  <button
                    className="secondary stop-button"
                    onClick={python.stop}
                  >
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
                  <pre
                    className="error-output"
                    aria-label="Errores del programa"
                  >
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
            {feedback ||
              "Escribe tu solución y pulsa Ejecutar para comprobarla."}
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
        </>
      )}
    </section>
  );
  const context = {
    draft: code,
    lastResult: lastCodeResult,
    selectedOptionId,
    selectionStatus,
    selectionResult,
    feedback: selectionFeedback,
  };
  return children
    ? children({ content, context, isRunning: python.status === "running" })
    : content;
}

function ChoicePractice({
  exercise,
  selectedOptionId,
  selectionStatus,
  selectionResult,
  feedback,
  approved,
  onSelect,
  onCheck,
}) {
  const feedbackTone =
    selectionStatus === "checked"
      ? selectionResult?.correct
        ? "success"
        : "retry"
      : "";
  return (
    <section
      className="choice-practice panel"
      aria-labelledby="choice-practice-heading"
    >
      <div className="choice-code">
        {exercise.code && (
          <pre aria-label="Fragmento de código de solo lectura">
            <code>{exercise.code}</code>
          </pre>
        )}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onCheck();
        }}
      >
        <fieldset>
          <legend id="choice-practice-heading">Elige una opción</legend>
          {exercise.options.map((option) => {
            const id = `choice-${exercise.id}-${option.id}`;
            return (
              <label className="choice-option" key={option.id} htmlFor={id}>
                <input
                  id={id}
                  type="radio"
                  name={`choice-${exercise.id}`}
                  value={option.id}
                  checked={selectedOptionId === option.id}
                  onChange={() => onSelect(option.id)}
                />
                <span>{option.text}</span>
              </label>
            );
          })}
        </fieldset>
        <button
          className="primary choice-check"
          type="submit"
          disabled={!selectedOptionId}
        >
          Comprobar
        </button>
      </form>
      <div
        className={`feedback choice-feedback ${feedbackTone}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {feedback || "Elige una opción para comprobar tu respuesta."}
      </div>
      {approved && (
        <p className="choice-approved" role="status">
          Ejercicio aprobado. Tu avance se conserva aunque sigas practicando.
        </p>
      )}
    </section>
  );
}
