import { validateCatalog, validateCourse } from "./catalog.js";

export const catalogStorageKey = "python-tutor:catalog:v1";

// Reconstruct courses from verified original text, never a second parsed copy.
export async function readCatalogBackup() {
  try {
    const raw = localStorage.getItem(catalogStorageKey);
    if (!raw) return null;
    const { catalog, courseFiles } = JSON.parse(raw);
    validateCatalog(catalog);
    const courses = {};
    for (const record of catalog.courses) {
      const source = courseFiles[record.id];
      if (typeof source !== "string") return null;
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
      const actual = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
      if (actual !== record.sha256) return null;
      courses[record.id] = validateCourse(JSON.parse(source), record.id);
    }
    return { catalog, courses, courseFiles };
  } catch {
    return null;
  }
}

export function saveCatalogBackup(publication) {
  try {
    // Single-value setItem is atomic: failure leaves the previous backup intact.
    localStorage.setItem(catalogStorageKey, JSON.stringify({
      catalog: publication.catalog,
      courseFiles: publication.courseFiles,
    }));
    return true;
  } catch {
    return false;
  }
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, canonical(value[key])]),
  );
  return value;
}

export function validatePublicationUpdate(previous, next) {
  if (!previous) return;
  if (previous.catalog.revision === next.catalog.revision &&
      JSON.stringify(canonical(previous.catalog)) !== JSON.stringify(canonical(next.catalog))) {
    throw new Error("Catálogo inválido: la misma revisión contiene otra publicación.");
  }
  const files = new Map(previous.catalog.courses.map(record => [record.file, record.sha256]));
  if (next.catalog.courses.some(record => files.has(record.file) && files.get(record.file) !== record.sha256)) {
    throw new Error("Catálogo inválido: se modificó un archivo de curso inmutable.");
  }
}
