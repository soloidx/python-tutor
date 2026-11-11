import { validateCourse, verifyIconSource } from "./catalog.js";
import { courseIdentity, originalCourseId, originalLocalId } from "./identity.js";
import { learnerGet, learnerSet, learnerRevision, performLearnerOperation } from "./learnerStore.js";

const pathsKey = "python-tutor:personal-paths:v1";
const draftKey = "python-tutor:personal-generator:draft:v1";
const debtKey = "python-tutor:personal-generator:pending-consumption:v1";
async function digest(source) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
async function verifyCopy(copy) {
  if (!copy || typeof copy.id !== "string" || typeof copy.source !== "string" || !/^[a-f0-9]{64}$/.test(copy.sha256) || await digest(copy.source) !== copy.sha256) throw new Error("No se pudo verificar la integridad del curso original.");
  const course = validateCourse(JSON.parse(copy.source), copy.id);
  const icons = [course, ...course.topics].flatMap(item => item.icon ? [item.icon] : []);
  for (const icon of icons) {
    if (typeof copy.icons?.[icon.file] !== "string") throw new Error("Falta una copia de un icono original.");
    await verifyIconSource(icon, copy.icons[icon.file]);
  }
  return course;
}
function readPaths() {
  const raw = learnerGet(pathsKey);
  if (raw === null) return [];
  const paths = JSON.parse(raw);
  if (!Array.isArray(paths)) throw new Error("Las rutas personales guardadas están dañadas.");
  return paths;
}
async function originalCopy(publication, localId) {
  const id = originalCourseId(localId);
  const record = publication.catalog.courses.find(item => item.id === id);
  const source = publication.courseFiles?.[localId];
  const course = publication.courses[id];
  if (!record || typeof source !== "string" || !course || originalLocalId(course.id) !== localId) return null;
  const icons = Object.fromEntries([course, ...course.topics].flatMap(item => item.icon ? [[item.icon.file, publication.iconFiles?.[item.icon.file]]] : []));
  const copy = { id: localId, source, sha256: record.sha256, icons };
  await verifyCopy(copy);
  return copy;
}
async function refreshCopies(publication, paths) {
  const refreshed = [];
  for (const path of paths) {
    if (!Array.isArray(path?.copies)) { refreshed.push(path); continue; }
    try {
      await Promise.all(path.copies.map(verifyCopy));
      const copies = await Promise.all(path.copies.map(async copy => await originalCopy(publication, copy.id) || copy));
      refreshed.push({ ...path, copies });
    } catch { refreshed.push(path); }
  }
  if (JSON.stringify(refreshed) === JSON.stringify(paths)) return paths;
  if (!navigator.locks) throw new Error("No se pueden proteger las copias entre pestañas.");
  await navigator.locks.request("python-tutor:learner", () => {
    if (JSON.stringify(readPaths()) !== JSON.stringify(paths)) throw new Error("Las rutas cambiaron en otra pestaña.");
    learnerSet(pathsKey, JSON.stringify(refreshed));
  });
  return refreshed;
}
export async function composePersonalPublication(publication) {
  let paths;
  try { paths = readPaths(); } catch { return { ...publication, personalWarning: "Las rutas personales guardadas están dañadas. Se conservan para recuperación." }; }
  let personalWarning = "";
  try { paths = await refreshCopies(publication, paths); } catch { return { ...publication, personalWarning: "No se pudieron actualizar las copias de originales de tus rutas. Se conservan las copias anteriores; las rutas personales se ocultaron hasta resolver el guardado." }; }
  const courses = { ...publication.courses };
  const iconFiles = { ...publication.iconFiles };
  const valid = [];
  const retiredRecords = [];
  for (const path of paths) {
    try {
      if (!path || typeof path.id !== "string" || typeof path.title !== "string" || !path.title.trim() || typeof path.description !== "string" || !path.description.trim() || !Array.isArray(path.copies) || !path.copies.length || path.copies.length > 10 || new Set(path.copies.map(copy => copy.id)).size !== path.copies.length) throw new Error("Ruta inválida");
      const verified = await Promise.all(path.copies.map(verifyCopy));
      for (let index = 0; index < verified.length; index++) {
        const copy = path.copies[index];
        const id = originalCourseId(copy.id);
        if (!courses[id]) {
          const retired = structuredClone(verified[index]);
          for (const item of [retired, ...retired.topics]) {
            if (!item.icon) continue;
            const file = `personal-copy/${copy.sha256}/${item.icon.file}`;
            iconFiles[file] = copy.icons[item.icon.file];
            item.icon.file = file;
          }
          courses[id] = { ...retired, id, retiredOriginal: true };
          retiredRecords.push({ id, retiredOriginal: true });
        }
      }
      valid.push({ id: courseIdentity("personal", path.id), title: path.title, description: path.description, courseIds: path.copies.map(copy => originalCourseId(copy.id)), personal: true });
    } catch { personalWarning = "Una ruta personal está dañada o incompleta. Se conservan sus datos para recuperación."; }
  }
  return { ...publication, personalWarning, courses, iconFiles, catalog: { ...publication.catalog, courses: [...publication.catalog.courses.filter(record => !record.retiredOriginal), ...retiredRecords], learningPaths: [...publication.catalog.learningPaths.filter(path => !path.personal), ...valid] } };
}
export async function incorporateOriginalPath({ publication, proposal, operationId, consumption }) {
  const copies = [];
  for (const localId of proposal.courseIds) {
    const copy = await originalCopy(publication, localId);
    if (!copy) throw new Error("Un curso original ya no está disponible.");
    copies.push(copy);
  }
  const paths = readPaths();
  const revision = learnerRevision();
  const path = { id: operationId, title: proposal.title, description: proposal.description, copies };
  return performLearnerOperation({ id: operationId, revision, changes: [
    { key: pathsKey, value: JSON.stringify([...paths, path]) },
    { key: draftKey, value: null },
    { key: debtKey, value: consumption.pending ? JSON.stringify({ ...consumption, id: operationId }) : null },
  ] });
}
