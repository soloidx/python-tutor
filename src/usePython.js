import { useEffect, useRef, useState } from "react";

export function usePython(onResult) {
  const worker = useRef(null);
  const timer = useRef(null);
  const receive = useRef(onResult);
  receive.current = onResult;
  const [status, setStatus] = useState("loading");
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    setStatus("loading");
    const instance = new Worker(new URL("python-worker.js", document.baseURI));
    worker.current = instance;
    const fail = (message) => {
      clearTimeout(timer.current);
      setStatus("error");
      receive.current({ passed: false, output: "", error: message });
      instance.terminate();
    };
    timer.current = setTimeout(
      () =>
        fail(
          "No se pudo cargar Python. Comprueba la conexión y vuelve a intentarlo.",
        ),
      45000,
    );
    instance.onmessage = ({ data }) => {
      clearTimeout(timer.current);
      if (data.type === "load-error")
        fail("No se pudo cargar Python. Vuelve a intentarlo.");
      else if (data.type === "ready") setStatus("ready");
      else {
        setStatus("ready");
        receive.current(data);
      }
    };
    instance.onerror = () =>
      fail("No se pudo iniciar Python. Vuelve a intentarlo.");
    return () => {
      clearTimeout(timer.current);
      instance.terminate();
    };
  }, [generation]);
  function run(code, check) {
    if (status !== "ready") return;
    setStatus("running");
    worker.current.postMessage({ code, check });
    timer.current = setTimeout(() => {
      worker.current.terminate();
      setStatus("error");
      receive.current({
        passed: false,
        output: "",
        error:
          "La ejecución superó 10 segundos. Revisa si hay un bucle infinito y reinicia Python.",
      });
    }, 10000);
  }
  function restart() {
    clearTimeout(timer.current);
    worker.current?.terminate();
    setStatus("loading");
    setGeneration((value) => value + 1);
  }
  function stop() {
    restart();
    receive.current({
      passed: false,
      output: "",
      error:
        "Ejecución detenida. Puedes corregir tu código y volver a intentarlo.",
    });
  }
  return { status, run, restart, stop };
}
