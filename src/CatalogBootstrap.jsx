import React, { useEffect, useState } from "react";
import App from "./App.jsx";
import { loadCatalog } from "./catalog.js";

export default function CatalogBootstrap() {
  const [publication, setPublication] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    loadCatalog({ signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) setPublication(value);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason.message || "Error de red al descargar el catálogo.");
      });
    return () => controller.abort();
  }, [attempt]);
  if (publication) return <App publication={publication} />;
  return (
    <main className="courses">
      <h1>Python Tutor</h1>
      {error ? (
        <>
          <p role="alert">No se pudo cargar el catálogo. {error}</p>
          <button
            className="primary"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Reintentar
          </button>
        </>
      ) : (
        <p role="status">Cargando catálogo…</p>
      )}
    </main>
  );
}
