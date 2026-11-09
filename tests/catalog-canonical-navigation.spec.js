import { test, expect, publication, serveCatalog, updateCourse, enterCourse } from './fixtures/catalog.js';

// The current registry is the set of active courses; no enrollment or active
// flag is added to the remote catalog contract for Práctica.
function currentPublication(revision, title) {
  const value = publication(revision);
  const record = value.catalog.courses[0];
  record.id = 'datos-abiertos';
  const course = JSON.parse(value.files[record.file]);
  course.id = record.id;
  value.files[record.file] = JSON.stringify(course);
  updateCourse(value, record.id, course => {
    course.title = title;
    course.topics = [course.topics[0]];
    course.topics[0].id = 'lectura-de-datos';
    course.topics[0].title = `Lectura ${revision}`;
    course.topics[0].exercises = [course.topics[0].exercises[0]];
    course.topics[0].exercises[0].id = 'primer-registro';
    course.topics[0].exercises[0].title = `Registro ${revision}`;
  });
  value.catalog.courses = [record];
  for (const path of value.catalog.learningPaths) path.courseIds = [record.id];
  return value;
}

test('opens canonical catalog identities and keeps shared learning when a new revision renames them', async ({ page, context }) => {
  await serveCatalog(context, currentPublication('datos-1', 'Datos abiertos'));
  await page.goto('/');
  await enterCourse(page, { course: 'Datos abiertos' });
  await expect(page.getByRole('heading', { name: 'Lectura datos-1', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Registro datos-1', exact: true })).toBeVisible();
  await page.getByLabel('Código Python').fill('nombre = "Ada"\nprint("Hola, " + nombre)');
  await page.getByRole('button', { name: 'Ejecutar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('¡Correcto!');

  await serveCatalog(context, currentPublication('datos-2', 'Datos públicos'));
  await page.reload();
  await page.getByRole('button', { name: 'Recargar para actualizar', exact: true }).click();
  await page.getByRole('button', { name: 'Explorar Camino a la automatización', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Datos públicos', exact: true })).toBeVisible();
  await expect(page.getByText('100% · 1 / 1 ejercicios aprobados', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver temas de Python Fundamentos', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Repasar Datos públicos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Lectura datos-2', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Registro datos-2', exact: true })).toBeVisible();
  await expect(page.getByText('1 / 1 ejercicios', { exact: true })).toBeVisible();
  // Course drafts retain their existing session-only behavior.
  await expect(page.getByLabel('Código Python')).toHaveValue('# Guarda un nombre y úsalo en el saludo\nnombre = ""\nprint("Hola, " + nombre)');
});
