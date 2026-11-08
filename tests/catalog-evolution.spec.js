import { test, expect, publication, updateCourse, serveCatalog, enterCourse } from './fixtures/catalog.js';

function shortPublication(revision, change = () => {}) {
  const value = publication(revision);
  for (const id of ['python-fundamentos', 'python-practica']) {
    updateCourse(value, id, course => {
      course.topics = course.topics.slice(0, 3);
      course.topics.forEach(topic => { topic.exercises = topic.exercises.slice(0, 1); });
      if (id === 'python-fundamentos') change(course);
    });
  }
  return value;
}

async function approve(page, code) {
  await page.getByLabel('Código Python').fill(code);
  await page.getByRole('button', { name: 'Ejecutar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('¡Correcto!');
}

async function activate(page, context, value) {
  await serveCatalog(context, value);
  await page.reload();
  await expect(page.getByText('Hay contenido nuevo. Recargar para actualizar', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Recargar para actualizar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Cursos y rutas de aprendizaje', exact: true })).toBeVisible();
}

const saludo = 'nombre = "Ada"\nprint("Hola, " + nombre)';
const compra = 'precio = 8\ncantidad = 3\ntotal = precio * cantidad\nprint(total)';

test('retiring the last topic resumes at the first pending topic with an explanation', async ({ page, context }) => {
  await serveCatalog(context, shortPublication('resume-1'));
  await page.goto('/');
  await enterCourse(page);
  await approve(page, saludo);
  await page.getByRole('button', { name: 'Siguiente tema', exact: true }).click();
  await page.getByRole('button', { name: 'Siguiente tema', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Condicionales', exact: true })).toBeVisible();

  await activate(page, context, shortPublication('resume-2', course => { course.topics.pop(); }));
  await enterCourse(page, { path: 'Camino a la automatización' });
  await expect(page.getByRole('heading', { name: 'Expresiones y salida', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Tu último tema ya no está disponible');
  await expect(page.getByRole('alert')).toContainText('Expresiones y salida');
  await expect(page.getByText('1 / 2 ejercicios', { exact: true })).toBeVisible();
  await page.reload();
  await enterCourse(page);
  await expect(page.getByRole('heading', { name: 'Expresiones y salida', exact: true })).toBeVisible();
  await expect(page.getByText('Tu último tema ya no está disponible', { exact: false })).toHaveCount(0);
});

test('retiring the last topic of a completed course reviews the first topic and explains why', async ({ page, context }) => {
  await serveCatalog(context, shortPublication('review-1'));
  await page.goto('/');
  await enterCourse(page);
  await approve(page, saludo);
  await page.getByRole('button', { name: 'Siguiente tema', exact: true }).click();
  await approve(page, compra);
  await page.getByRole('button', { name: 'Siguiente tema', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Condicionales', exact: true })).toBeVisible();
  await activate(page, context, shortPublication('review-2', course => { course.topics.pop(); }));
  await page.getByRole('button', { name: 'Explorar Primeros pasos con Python', exact: true }).click();
  await page.getByRole('button', { name: 'Repasar Python Fundamentos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Valores y variables', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('todos sus ejercicios vigentes están aprobados');
  await expect(page.getByText('2 / 2 ejercicios', { exact: true })).toBeVisible();
});

const article = (page, title) => page.getByRole('article').filter({
  has: page.getByRole('heading', { name: title, exact: true }),
});

async function sharedSummary(page, summary, status) {
  await expect(article(page, 'Camino a la automatización').getByText(status, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Explorar Camino a la automatización', exact: true }).click();
  await expect(article(page, 'Python Fundamentos').getByText(summary, { exact: true })).toBeVisible();
  await expect(article(page, 'Python Fundamentos').getByText(status, { exact: true })).toBeVisible();
}

test('successive publications count current exercises and preserve approvals by pedagogical identity', async ({ page, context }) => {
  const one = revision => shortPublication(revision, course => {
    course.topics = [course.topics[0]];
  });
  await serveCatalog(context, one('identity-1'));
  await page.goto('/');
  await enterCourse(page);
  await approve(page, saludo);
  await page.getByRole('button', { name: 'Todas las rutas', exact: true }).click();
  await sharedSummary(page, '100% · 1 / 1 ejercicios aprobados', 'Completado');

  const corrected = one('identity-2');
  updateCourse(corrected, 'python-fundamentos', course => {
    course.topics[0].title = 'Variables corregidas';
    Object.assign(course.topics[0].exercises[0], {
      title: 'Saludo corregido', prompt: 'Usa tu variable para saludar.', check: 'False',
    });
  });
  await activate(page, context, corrected);
  await sharedSummary(page, '100% · 1 / 1 ejercicios aprobados', 'Completado');
  await page.getByRole('button', { name: 'Repasar Python Fundamentos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Variables corregidas', exact: true })).toBeVisible();
  await approveFailedCorrection(page);

  const added = one('identity-3');
  updateCourse(added, 'python-fundamentos', course => {
    course.topics[0].exercises.push({ ...course.topics[0].exercises[0], id: 'nuevo-objetivo', title: 'Nuevo objetivo pedagógico' });
  });
  await activate(page, context, added);
  await sharedSummary(page, '50% · 1 / 2 ejercicios aprobados', 'En progreso');

  const retired = one('identity-4');
  updateCourse(retired, 'python-fundamentos', course => {
    course.topics[0].exercises[0].id = 'nuevo-objetivo';
  });
  await activate(page, context, retired);
  await sharedSummary(page, '0% · 0 / 1 ejercicios aprobados', 'Sin iniciar');
  await page.getByRole('button', { name: 'Continuar Python Fundamentos', exact: true }).click();
  await expect(page.getByText('0 / 1 ejercicios', { exact: true })).toBeVisible();

  // Rebuild the same identities under new immutable publication filenames.
  const returned = one('identity-5');
  updateCourse(returned, 'python-fundamentos', course => {
    course.topics[0].exercises.push({ ...course.topics[0].exercises[0], id: 'nuevo-objetivo' });
  });
  await activate(page, context, returned);
  await sharedSummary(page, '50% · 1 / 2 ejercicios aprobados', 'En progreso');
  await activate(page, context, one('identity-6'));
  await sharedSummary(page, '100% · 1 / 1 ejercicios aprobados', 'Completado');
});

async function approveFailedCorrection(page) {
  await page.getByLabel('Código Python').fill(saludo);
  await page.getByRole('button', { name: 'Ejecutar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Todavía no');
  await expect(page.getByText('1 / 1 ejercicios', { exact: true })).toBeVisible();
}

test('adding, retiring and reintroducing courses recalculates paths without erasing retired learning', async ({ page, context }) => {
  function courses(revision) {
    const value = shortPublication(revision);
    for (const id of ['python-fundamentos', 'python-practica']) {
      updateCourse(value, id, course => { course.topics = [course.topics[0]]; });
    }
    return value;
  }
  await serveCatalog(context, courses('courses-1'));
  await page.goto('/');
  await enterCourse(page);
  await approve(page, saludo);
  await page.getByRole('button', { name: 'Todas las rutas', exact: true }).click();
  await enterCourse(page, { course: 'Python Práctica' });
  await approve(page, saludo);
  await page.getByRole('button', { name: 'Todas las rutas', exact: true }).click();
  await expect(article(page, 'Primeros pasos con Python').getByText('Completado', { exact: true })).toBeVisible();

  const shared = courses('courses-2');
  shared.catalog.learningPaths[1].courseIds.push('python-practica');
  await activate(page, context, shared);
  await expect(article(page, 'Camino a la automatización').getByText('Completado', { exact: true })).toBeVisible();
  await enterCourse(page, { path: 'Camino a la automatización', course: 'Python Práctica' });
  await expect(page.getByText('1 / 1 ejercicios', { exact: true })).toBeVisible();

  function withNewCourse(revision) {
    const value = courses(revision);
    const extra = publication(revision);
    // The new pedagogical course has its own identity and immutable file.
    const record = extra.catalog.courses[1];
    const authored = JSON.parse(extra.files[record.file]);
    authored.id = 'python-nuevo';
    authored.title = 'Python Nuevo';
    authored.topics = [authored.topics[0]];
    authored.topics[0].exercises = [authored.topics[0].exercises[0]];
    const file = `courses/python-nuevo.${revision}.json`;
    value.files[file] = JSON.stringify(authored);
    value.catalog.courses.push({ id: authored.id, file, sha256: record.sha256 });
    // Reuse the fixture's public authoring boundary to calculate exact bytes/hash.
    updateCourse(value, authored.id, () => {});
    for (const path of value.catalog.learningPaths) path.courseIds.push(authored.id);
    return value;
  }
  await activate(page, context, withNewCourse('courses-3'));
  await expect(article(page, 'Camino a la automatización').getByText('En progreso', { exact: true })).toBeVisible();

  const retired = withNewCourse('courses-4');
  retired.catalog.courses = retired.catalog.courses.filter(course => course.id === 'python-nuevo');
  retired.catalog.learningPaths.forEach(path => { path.courseIds = ['python-nuevo']; });
  await activate(page, context, retired);
  await expect(article(page, 'Primeros pasos con Python').getByText('Sin iniciar', { exact: true })).toBeVisible();
  await expect(article(page, 'Camino a la automatización').getByText('Sin iniciar', { exact: true })).toBeVisible();
  await enterCourse(page, { course: 'Python Nuevo' });
  await expect(page.getByText('0 / 1 ejercicios', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);

  await activate(page, context, courses('courses-5'));
  await expect(article(page, 'Primeros pasos con Python').getByText('Completado', { exact: true })).toBeVisible();
  await sharedSummary(page, '100% · 1 / 1 ejercicios aprobados', 'Completado');
  await page.getByRole('button', { name: 'Repasar Python Fundamentos', exact: true }).click();
  await expect(page.getByText('1 / 1 ejercicios', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Todas las rutas', exact: true }).click();
  await enterCourse(page, { course: 'Python Práctica' });
  await expect(page.getByText('1 / 1 ejercicios', { exact: true })).toBeVisible();
});
