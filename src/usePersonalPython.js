import { useEffect, useRef, useState } from "react";
import { createPersonalExecutor } from "./personalExecutor.js";

export function usePersonalPython(configuration, onResult) {
  const origin = configuration?.origin;
  const rules = useRef(configuration?.rules);
  rules.current = configuration?.rules;
  const receive = useRef(onResult);
  receive.current = onResult;
  const executor = useRef(null);
  const running = useRef(false);
  const alive = useRef(false);
  const [status, setStatus] = useState("loading");
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    if (!origin) {
      if (configuration) setStatus("error");
      return;
    }
    let disposed = false;
    alive.current = true;
    setStatus("loading");
    try {
      const instance = createPersonalExecutor({ origin, onStatus: (value) => {
        if (!disposed) setStatus(running.current && value !== "ready" ? "running" : value === "cancelling" ? "running" : value);
      } });
      executor.current = instance;
      return () => { disposed = true; alive.current = false; running.current = false; executor.current = null; instance.close(); };
    } catch {
      setStatus("error");
    }
  }, [origin, generation]);
  function run(code) {
    if (!executor.current || running.current) return;
    try {
      running.current = true;
      setStatus("running");
      const instance = executor.current;
      instance.run(code, rules.current).then((result) => {
        if (!alive.current || executor.current !== instance) return;
        running.current = false;
        const error = result.status === "accepted" || result.status === "rejected" ? null : result.status === "cancelled" ? "Ejecución detenida. Puedes volver a intentarlo." : result.message || "No se pudo validar este intento.";
        receive.current({ passed: result.status === "accepted", output: result.output, error, validationStatus: result.status });
      });
    } catch (error) {
      running.current = false;
      setStatus("ready");
      receive.current({ passed: false, output: "", error: error.message, validationStatus: typeof code === "string" && code.length > 16000 ? "limit" : "unsupported" });
    }
  }
  return { status, run, stop: () => executor.current?.cancel(), restart: () => setGeneration((value) => value + 1) };
}
