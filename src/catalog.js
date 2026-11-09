import { validateSvgIcon } from "./svgIcon.js";
// One predetermined public source; publishing and operating it are external to this app.
export const catalogBaseUrl = "https://www.ider.ninja/python-tutor-content/";

function requireValue(condition, reason) {
  if (!condition) throw new Error(`Catálogo inválido: ${reason}.`);
}
function object(value, at) {
  requireValue(
    value !== null && typeof value === "object" && !Array.isArray(value),
    `${at} debe ser un objeto`,
  );
}
function text(value, at) {
  requireValue(
    typeof value === "string" && value.trim().length > 0,
    `${at} debe ser texto no vacío`,
  );
}
function list(value, at, nonempty = true) {
  requireValue(
    Array.isArray(value) && (!nonempty || value.length > 0),
    `${at} debe ser una lista${nonempty ? " no vacía" : ""}`,
  );
}
function slug(value, at) {
  requireValue(
    typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
    `${at} debe ser un slug ASCII`,
  );
}
function unique(values, at) {
  requireValue(
    new Set(values).size === values.length,
    `${at} contiene IDs duplicados`,
  );
}
function fields(value, names, at) {
  names.forEach((name) => text(value[name], `${at}.${name}`));
}
function version(value, at) {
  object(value, at);
  requireValue(value.schemaVersion === 1, `${at}: schemaVersion desconocida`);
}

export function courseFileUrl(file) {
  text(file, "course.file");
  // Percent encoding, backslashes, fragments, queries and empty/dot segments are
  // intentionally disallowed rather than normalized into a different reference.
  requireValue(
    !/[:\\%?#]/.test(file) &&
      !file.startsWith("/") &&
      file.split("/").every((part) => part && part !== "." && part !== ".."),
    "course.file debe ser relativo y permanecer en el directorio base",
  );
  const url = new URL(file, catalogBaseUrl);
  requireValue(
    url.origin === new URL(catalogBaseUrl).origin &&
      url.href.startsWith(catalogBaseUrl),
    "course.file fuera de la fuente",
  );
  return url.href;
}
function validateIcon(icon) {
  if (icon === undefined) return;
  object(icon, "icon");
  courseFileUrl(icon.file);
  requireValue(icon.file.endsWith(".svg"), "icon.file debe terminar en .svg");
  requireValue(typeof icon.sha256 === "string" && /^[a-f0-9]{64}$/.test(icon.sha256), "icon.sha256 incorrecto");
}
export function publicationIcons(catalog, courses) {
  const icons = [...catalog.learningPaths, ...Object.values(courses).flatMap(course => [course, ...course.topics])].flatMap(item => item.icon ? [item.icon] : []);
  const files = new Map();
  for (const icon of icons) {
    validateIcon(icon);
    requireValue(!files.has(icon.file) || files.get(icon.file).sha256 === icon.sha256, "huellas de icono contradictorias");
    files.set(icon.file, icon);
  }
  return [...files.values()];
}
export async function verifyIconSource(icon, source) {
  validateSvgIcon(source);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  const actual = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  requireValue(actual === icon.sha256, `huella SVG incorrecta para ${icon.file}`);
}
export function validateCatalog(catalog) {
  version(catalog, "catalog");
  text(catalog.revision, "catalog.revision");
  list(catalog.courses, "catalog.courses");
  list(catalog.learningPaths, "catalog.learningPaths");
  for (const record of catalog.courses) {
    object(record, "course record");
    slug(record.id, "course.id");
    courseFileUrl(record.file);
    requireValue(
      typeof record.sha256 === "string" && /^[a-f0-9]{64}$/.test(record.sha256),
      "course.sha256 debe ser una huella SHA-256 hexadecimal",
    );
  }
  unique(
    catalog.courses.map((course) => course.id),
    "catalog.courses",
  );
  unique(
    catalog.courses.map((course) => course.file),
    "catalog.courses.file",
  );
  const ids = new Set(catalog.courses.map((course) => course.id));
  const included = new Set();
  for (const path of catalog.learningPaths) {
    object(path, "learningPath");
    slug(path.id, "learningPath.id");
    validateIcon(path.icon);
    fields(path, ["title", "description"], "learningPath");
    list(path.courseIds, "learningPath.courseIds");
    unique(path.courseIds, "learningPath.courseIds");
    for (const id of path.courseIds) {
      slug(id, "learningPath.courseIds");
      requireValue(ids.has(id), `referencia de curso inexistente ${id}`);
      included.add(id);
    }
  }
  unique(
    catalog.learningPaths.map((path) => path.id),
    "catalog.learningPaths",
  );
  requireValue(
    [...ids].every((id) => included.has(id)),
    "todo curso debe pertenecer a una ruta",
  );
  return catalog;
}
export function validateCourse(course, expectedId) {
  version(course, "course");
  slug(course.id, "course.id");
  validateIcon(course.icon);
  requireValue(
    course.id === expectedId,
    "ID del documento de curso no coincide con el registro",
  );
  fields(course, ["title", "description"], "course");
  list(course.topics, "course.topics");
  const exercises = [];
  for (const topic of course.topics) {
    object(topic, "topic");
    slug(topic.id, "topic.id");
    validateIcon(topic.icon);
    fields(topic, ["title", "summary", "example", "takeaway"], "topic");
    if (topic.duration !== undefined) text(topic.duration, "topic.duration");
    list(topic.explanation, "topic.explanation");
    topic.explanation.forEach((paragraph) =>
      text(paragraph, "topic.explanation"),
    );
    list(topic.exercises, "topic.exercises");
    for (const exercise of topic.exercises) {
      object(exercise, "exercise");
      slug(exercise.id, "exercise.id");
      fields(
        exercise,
        ["title", "prompt", "check", "success", "retry"],
        "exercise",
      );
      requireValue(
        typeof exercise.starter === "string",
        "exercise.starter debe ser texto",
      );
      list(exercise.hints, "exercise.hints", false);
      exercise.hints.forEach((hint) => text(hint, "exercise.hints"));
      exercises.push(exercise.id);
    }
  }
  unique(
    course.topics.map((topic) => topic.id),
    "course.topics",
  );
  unique(exercises, "course.exercises");
  if (course.assessment !== undefined) {
    object(course.assessment, "assessment");
    list(course.assessment.questions, "assessment.questions");
    for (const question of course.assessment.questions) {
      object(question, "question");
      slug(question.id, "question.id");
      fields(question, ["prompt", "explanation"], "question");
      if (question.code !== undefined) text(question.code, "question.code");
      list(question.options, "question.options");
      requireValue(
        question.options.length >= 2,
        "question.options necesita al menos dos opciones",
      );
      for (const option of question.options) {
        object(option, "option");
        slug(option.id, "option.id");
        text(option.text, "option.text");
      }
      unique(
        question.options.map((option) => option.id),
        "question.options",
      );
      slug(question.answerId, "question.answerId");
      requireValue(
        question.options.some((option) => option.id === question.answerId),
        "question.answerId no existe en las opciones",
      );
    }
    unique(
      course.assessment.questions.map((question) => question.id),
      "assessment.questions",
    );
  }
  return course;
}
export function validatePublication(publication) {
  object(publication, "publication");
  validateCatalog(publication.catalog);
  object(publication.courses, "publication.courses");
  for (const record of publication.catalog.courses)
    validateCourse(publication.courses[record.id], record.id);
  return publication;
}
async function download(url, signal) {
  const response = await fetch(url, {
    signal,
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok)
    throw new Error(`Error de descarga HTTP ${response.status}: ${url}`);
  return response;
}
function parse(text, at) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`JSON inválido: ${at}.`);
  }
}
export async function loadCatalog({ signal } = {}) {
  const catalog = validateCatalog(
    parse(
      await (
        await download(new URL("catalog.json", catalogBaseUrl), signal)
      ).text(),
      "catalog",
    ),
  );
  const courseFiles = {};
  const courses = await Promise.all(
    catalog.courses.map(async (record) => {
      const bytes = await (
        await download(courseFileUrl(record.file), signal)
      ).arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const actual = [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      requireValue(
        actual === record.sha256,
        `huella SHA-256 incorrecta para ${record.id}`,
      );
      const source = new TextDecoder("utf-8", {
        fatal: true,
        ignoreBOM: true,
      }).decode(bytes);
      const course = validateCourse(parse(source, record.id), record.id);
      courseFiles[record.id] = source;
      return [record.id, course];
    }),
  );
  const courseMap = Object.fromEntries(courses);
  const iconFiles = Object.fromEntries(await Promise.all(publicationIcons(catalog, courseMap).map(async icon => {
    const bytes = await (await download(courseFileUrl(icon.file), signal)).arrayBuffer();
    const source = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    await verifyIconSource(icon, source);
    return [icon.file, source];
  })));
  return { catalog, courses: courseMap, courseFiles, iconFiles };
}
