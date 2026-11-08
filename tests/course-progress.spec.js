import { test, expect, enterCourse } from './fixtures/catalog.js';

test('course approvals and resume are shared across paths and isolated from other courses', async ({ page }) => {
  await page.goto('/');
  const path = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Primeros pasos con Python', exact: true }) });
  await expect(path.getByText('Sin iniciar', { exact: true })).toBeVisible();
  await enterCourse(page);
  await page.getByLabel('Código Python').fill('nombre = "Ada"\nprint("Hola, " + nombre)');
  await page.getByRole('button', { name: 'Ejecutar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('¡Correcto!');
  await expect(page.getByRole('heading', { name: 'Valores y variables', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente tema', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Expresiones y salida', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Valores y variables', exact: true })).toBeVisible();
  await expect(page.getByText('1 / 12 ejercicios', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Todas las rutas', exact: true }).click();
  await expect(path.getByText('En progreso', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Explorar Camino a la automatización', exact: true }).click();
  const shared = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Python Fundamentos', exact: true }) });
  await expect(shared.getByText('8% · 1 / 12 ejercicios aprobados', { exact: true })).toBeVisible();
  await expect(shared.getByText('En progreso', { exact: true })).toBeVisible();
  await shared.getByRole('button', { name: 'Continuar Python Fundamentos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Valores y variables', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Cursos y rutas de aprendizaje', exact: true })).toBeVisible();
  await enterCourse(page, { course: 'Python Práctica' });
  await expect(page.getByText('0 / 12 ejercicios', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Todas las rutas', exact: true }).click();
  await enterCourse(page);
  await expect(page.getByText('1 / 12 ejercicios', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Valores y variables', exact: true })).toBeVisible();
});

test('visits and legacy data do not approve exercises; completing a shared course offers Repasar', async ({ page, context }) => {
  const { publication, updateCourse, serveCatalog } = await import('./fixtures/catalog.js');
  const value = publication('short-course');
  updateCourse(value, 'python-fundamentos', (course) => {
    course.topics = [course.topics[0]];
    course.topics[0].exercises = [course.topics[0].exercises[0]];
  });
  await serveCatalog(context, value);
  await page.addInitScript(() => localStorage.setItem('python-tutor.progress.v1', JSON.stringify({
    selectedRoute: 'python-fundamentos', view: 'learn', topicId: 'valores-variables', completed: ['saludo'], assessmentResult: null,
  })));
  await page.goto('/');
  await enterCourse(page);
  await expect(page.getByText('0 / 1 ejercicios', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Volver a temas', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Continuar curso', exact: true })).toBeVisible();
  await expect(page.getByText('Sin iniciar', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar curso', exact: true }).click();
  await page.getByLabel('Código Python').fill('nombre = "Ada"\nprint("Hola, " + nombre)');
  await page.getByRole('button', { name: 'Ejecutar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('¡Correcto!');
  // An unsuccessful later attempt never revokes an approval.
  await page.getByLabel('Código Python').fill('print("intento fallido")');
  await page.getByRole('button', { name: 'Ejecutar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Todavía no');
  await page.getByRole('button', { name: 'Volver a temas', exact: true }).last().click();
  await expect(page.getByText('100% · 1 / 1 ejercicios aprobados', { exact: true })).toBeVisible();
  await expect(page.getByText('Completado', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Repasar curso', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Todas las rutas', exact: true }).click();
  const completedPath = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Camino a la automatización', exact: true }) });
  await expect(completedPath.getByText('Completado', { exact: true })).toBeVisible();
  const incompletePath = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Primeros pasos con Python', exact: true }) });
  await expect(incompletePath.getByText('En progreso', { exact: true })).toBeVisible();
  await page.reload();
  await enterCourse(page, { path: 'Camino a la automatización' });
  await expect(page.getByText('1 / 1 ejercicios', { exact: true })).toBeVisible();
  const nextPage = await context.newPage();
  await page.close();
  await nextPage.goto('/');
  await enterCourse(nextPage);
  await expect(nextPage.getByText('1 / 1 ejercicios', { exact: true })).toBeVisible();
});
