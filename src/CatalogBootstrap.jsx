import React, { useEffect, useRef, useState } from "react";
import App from "./App.jsx";
import { loadCatalog } from "./catalog.js";
import { readCatalogBackup, saveCatalogBackup, validatePublicationUpdate } from "./catalogCache.js";

const temporaryMessage = "Este contenido no pudo guardarse; al recargar necesitarás volver a descargarlo";

export default function CatalogBootstrap() {
  const [publication, setPublication] = useState(null);
  const active = useRef(null);
  const [error, setError] = useState("");
  const [temporary, setTemporary] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const fresh = useRef(new URLSearchParams(window.location.search).has("catalog-update"));
  useEffect(() => {
    // This marker also works when browser storage writes are blocked. Consume
    // it once so subsequent ordinary reloads retain immediate backup loading.
    const url = new URL(window.location.href);
    url.searchParams.delete("catalog-update");
    window.history.replaceState(window.history.state, "", url);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    const activate = value => {
      if (!active.current) {
        active.current = value;
        setPublication(value);
      }
    };
    // Download and verify the saved backup in parallel. Handle remote rejection
    // immediately, even if digest validation of the backup takes longer.
    const remote = loadCatalog({ signal: controller.signal }).then(
      value => ({ value }), reason => ({ reason }),
    );
    (async () => {
      const backup = await readCatalogBackup();
      if (controller.signal.aborted) return;
      if (backup && !fresh.current) activate(backup);
      const { value, reason } = await remote;
      if (controller.signal.aborted) return;
      try {
        if (reason) throw reason;
        validatePublicationUpdate(backup, value);
        validatePublicationUpdate(active.current, value);
        const saved = saveCatalogBackup(value);
        setTemporary(!saved);
        if (!active.current) activate(value);
        else if (active.current.catalog.revision !== value.catalog.revision) setUpdated(true);
      } catch (reason) {
        if (backup) activate(backup);
        setError(reason.message || "Error de red al descargar el catálogo.");
      }
      fresh.current = false;
    })();
    return () => controller.abort();
  }, [attempt]);
  const retry = <button className="primary" onClick={() => setAttempt(value => value + 1)}>Reintentar</button>;
  return <>
    {publication ? <>
      {error && <aside role="alert">No se pudo actualizar el catálogo. {error} {retry}</aside>}
      {temporary && <aside role="alert"><p>{temporaryMessage}</p>{!error && retry}</aside>}
      {updated && <aside role="status">
        <p>Hay contenido nuevo. Recargar para actualizar</p>
        <button className="primary" onClick={() => {
          if (!temporary) {
            window.location.reload();
            return;
          }
          const url = new URL(window.location.href);
          url.searchParams.set("catalog-update", "1");
          window.location.assign(url.href);
        }}>Recargar para actualizar</button>
      </aside>}
      <App publication={publication} />
    </> : <main className="courses">
      <h1>Python Tutor</h1>
      {error ? <><p role="alert">No se pudo cargar el catálogo. {error}</p>{retry}</> : <p role="status">Cargando catálogo…</p>}
    </main>}
  </>;
}
