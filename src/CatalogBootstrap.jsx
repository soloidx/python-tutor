import React, { useEffect, useRef, useState } from "react";
import App from "./App.jsx";
import { composePersonalPublication } from "./personalCatalog.js";
import { originalPublication } from "./identity.js";
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
  const refreshPersonal = useRef(new URLSearchParams(window.location.search).has("personal-refresh"));
  useEffect(() => {
    // This marker also works when browser storage writes are blocked. Consume
    // it once so subsequent ordinary reloads retain immediate backup loading.
    const url = new URL(window.location.href);
    url.searchParams.delete("catalog-update");
    url.searchParams.delete("personal-refresh");
    window.history.replaceState(window.history.state, "", url);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    const activate = async (value, refresh = false) => {
      if (!active.current) {
        active.current = value;
        const composed = import.meta.env.DEV ? await composePersonalPublication(originalPublication(value), { refresh }) : originalPublication(value);
        if (!controller.signal.aborted) setPublication(composed);
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
      if (backup && !fresh.current) await activate(backup, refreshPersonal.current);
      const { value, reason } = await remote;
      if (controller.signal.aborted) return;
      try {
        if (reason) throw reason;
        validatePublicationUpdate(backup, value);
        validatePublicationUpdate(active.current, value);
        const saved = saveCatalogBackup(value);
        setTemporary(!saved);
        if (!active.current) await activate(value, true);
        else if (active.current.catalog.revision !== value.catalog.revision) setUpdated(true);
      } catch (reason) {
        if (backup) await activate(backup, fresh.current);
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
          const url = new URL(window.location.href);
          url.searchParams.set(temporary ? "catalog-update" : "personal-refresh", "1");
          window.location.assign(url.href);
        }}>Recargar para actualizar</button>
      </aside>}
      {publication.personalWarning && <aside role="alert">{publication.personalWarning}</aside>}
      <App publication={publication} onPersonalIncorporated={async () => setPublication(await composePersonalPublication(originalPublication(active.current)))} />
    </> : <main className="courses">
      <h1>Python Tutor</h1>
      {error ? <><p role="alert">No se pudo cargar el catálogo. {error}</p>{retry}</> : <p role="status">Cargando catálogo…</p>}
    </main>}
  </>;
}
