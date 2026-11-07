/* The interpreter lives off the UI thread. All runtime assets ship with the site. */
importScripts("./runtime/pyodide.js");
let output = "";
let errors = "";
const append = (current, text) => (current + text + "\n").slice(0, 20000);
const ready = loadPyodide({
  indexURL: new URL("./runtime/", self.location.href).href,
  stdout: (text) => {
    output = append(output, text);
  },
  stderr: (text) => {
    errors = append(errors, text);
  },
  stdin: () => {
    throw new Error(
      "Estos ejercicios no usan input(); escribe los valores en el código.",
    );
  },
});
ready
  .then(() => postMessage({ type: "ready" }))
  .catch((error) => postMessage({ type: "load-error", error: String(error) }));
function flushStreams(python) {
  // Pyodide's batched handlers emit partial lines only when the fd is synced.
  python.runPython(
    "import sys, os; sys.stdout.flush(); sys.stderr.flush(); os.fsync(1); os.fsync(2)",
  );
}

self.onmessage = async ({ data: { code, check } }) => {
  let namespace;
  try {
    const python = await ready;
    // Discard any pending runtime initialization output before this attempt.
    flushStreams(python);
    output = "";
    errors = "";
    namespace = python.globals.get("dict")();
    try {
      const result = await python.runPythonAsync(code, { globals: namespace });
      result?.destroy?.();
    } finally {
      // Capture partial output before checking work or reporting a Python error.
      flushStreams(python);
    }
    namespace.set("_output", output.trimEnd());
    let passed = false;
    // A missing variable is incorrect work, not a program execution error.
    try {
      passed = Boolean(
        python.runPython(`bool(${check})`, { globals: namespace }),
      );
    } catch {
      passed = false;
    }
    postMessage({
      type: "result",
      output: output.trimEnd(),
      error: errors.trimEnd(),
      passed: passed && !errors,
    });
  } catch (error) {
    postMessage({
      type: "result",
      output: output.trimEnd(),
      error: String(error),
      passed: false,
    });
  } finally {
    namespace?.destroy();
  }
};
