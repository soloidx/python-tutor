/* PROTOTYPE: functional observations, not a certified security boundary. */
(() => {
  const send = self.postMessage.bind(self);
  const assets = new Map();
  const decoder = new TextDecoder();
  let output = "", errors = "", overflow = false, python;
  const append = (channel, text) => {
    const next = String(text) + "\n";
    const previous = channel === "out" ? output : errors;
    if (previous.length + next.length > 20000) overflow = true;
    const value = (previous + next).slice(0, 20000);
    if (channel === "out") output = value; else errors = value;
  };
  self.fetch = async (url) => {
    const key = String(url).replace("https://prototype-runtime.invalid/", "");
    if (!assets.has(key)) throw new Error("Recurso no incluido en el prototipo.");
    return new Response(assets.get(key), {headers: {"Content-Type": key.endsWith(".wasm") ? "application/wasm" : "application/octet-stream"}});
  };
  self.onmessage = async ({data}) => {
    if (data.type === "bootstrap") {
      try {
        for (const [key, value] of Object.entries(data.assets)) assets.set(key, value);
        python = await loadPyodide({
          indexURL: "https://prototype-runtime.invalid/",
          lockFileContents: decoder.decode(assets.get("pyodide-lock.json")),
          jsglobals: {},
          stdout: (text) => append("out", text),
          stderr: (text) => append("err", text),
          stdin: () => { throw new Error("Este perfil no admite input()."); },
        });
        if (python.version !== "0.28.3") throw new Error("Se requiere Pyodide 0.28.3.");
        send({type: "ready", version: python.version});
      } catch (error) { send({type: "load-error", message: String(error)}); }
      return;
    }
    if (data.type !== "run" || !python) return;
    let namespace;
    const flush = () => python.runPython("import sys, os; sys.stdout.flush(); sys.stderr.flush(); os.fsync(1); os.fsync(2)");
    try {
      flush(); output = ""; errors = ""; overflow = false;
      namespace = python.globals.get("dict")();
      const result = await python.runPythonAsync(data.code, {globals: namespace});
      result?.destroy?.();
      flush();
      const variables = Object.create(null);
      for (const name of data.names) {
        const value = namespace.get(name);
        const type = typeof value;
        if (type === "string" && value.length <= 20000) variables[name] = {type, value};
        else if (type === "boolean") variables[name] = {type, value};
        else if (type === "number" && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER) variables[name] = {type, value};
        else {
          value?.destroy?.();
          send({type: "unsupported", name, output: output.trimEnd(), message: "Variable ausente o fuera del perfil: solo texto, booleanos y números finitos dentro del rango admitido."});
          return;
        }
      }
      if (overflow) send({type: "limit", message: "La salida superó 20.000 caracteres; el caso no se valida."});
      else if (errors) send({type: "execution-error", message: errors, output: output.trimEnd()});
      else send({type: "observations", output: output.trimEnd(), variables});
    } catch (error) {
      try { flush(); } catch {}
      send({type: overflow ? "limit" : "execution-error", message: overflow ? "La salida superó el límite." : String(error).slice(0, 20000), output: output.trimEnd()});
    } finally { namespace?.destroy(); }
  };
})();
