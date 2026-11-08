import { test, expect, publication, updateCourse, serveCatalog } from './fixtures/catalog.js';

const question = (id = 'valor') => ({
  id, prompt: `Pregunta ${id}`, code: 'print(2)',
  options: [{ id: 'dos', text: 'Dos' }, { id: 'tres', text: 'Tres' }],
  answerId: 'dos', explanation: 'El programa muestra dos.',
});
function assessmentPublication(revision = 'assessment') {
  const value = publication(revision);
  updateCourse(value, 'python-fundamentos', course => { course.assessment = { questions: [question(), question('salida')] }; });
  return value;
}
async function topics(page, { path = 'Primeros pasos con Python', course = 'Python Fundamentos' } = {}) {
  await page.getByRole('button', { name: `Explorar ${path}`, exact: true }).click();
  await page.getByRole('button', { name: `Ver temas de ${course}`, exact: true }).click();
}
async function submit(page) {
  await page.getByRole('button', { name: 'Comenzar evaluación final', exact: true }).click();
  await page.getByRole('group').nth(0).getByRole('radio', { name: 'Dos', exact: true }).check();
  await page.getByRole('group').nth(1).getByRole('radio', { name: 'Tres', exact: true }).check();
  await page.getByRole('button', { name: 'Ver resultado', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu resultado: 1 de 2', exact: true })).toBeVisible();
}

test('retired assessment questions and temporarily absent assessment survive course visits', async ({ page, context }) => {
  const value = assessmentPublication();
  await serveCatalog(context, value);
  await page.goto('/');
  await topics(page);
  await submit(page);
  const absent = assessmentPublication('absent');
  updateCourse(absent, 'python-fundamentos', course => { delete course.assessment; });
  await serveCatalog(context, absent);
  await page.reload();
  await topics(page);
  await expect(page.getByRole('button', { name: /evaluación final/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Comenzar curso', exact: true }).click();
  const retired = assessmentPublication('retired');
  updateCourse(retired, 'python-fundamentos', course => { course.assessment.questions.pop(); });
  await serveCatalog(context, retired);
  await page.reload();
  await topics(page);
  await page.getByRole('button', { name: 'Ver evaluación final', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu resultado: 1 de 1', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Volver a las lecciones', exact: true }).click();
  await serveCatalog(context, assessmentPublication('restored'));
  await page.reload();
  await topics(page);
  await page.getByRole('button', { name: 'Ver evaluación final', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu resultado: 1 de 2', exact: true })).toBeVisible();
  await expect(page.getByRole('group').nth(1).getByRole('radio', { name: 'Tres', exact: true })).toBeChecked();
});

test('optional assessment review is shared across paths, isolated by course and independent of approvals', async ({ page, context }) => {
  const value = assessmentPublication();
  updateCourse(value, 'python-practica', course => { course.assessment = { questions: [question(), question('salida')] }; });
  await serveCatalog(context, value);
  await page.goto('/');
  await topics(page);
  await expect(page.getByText('0% · 0 / 12 ejercicios aprobados', { exact: true })).toBeVisible();
  await submit(page);
  await expect(page.getByText('Respuesta correcta: Dos', { exact: true })).toBeVisible();
  await expect(page.getByText('El programa muestra dos.', { exact: true })).toHaveCount(2);
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(2);
  await expect(page.getByRole('radio').first()).toBeDisabled();
  await page.getByRole('button', { name: 'Todas las rutas', exact: true }).click();
  const pathCards = page.getByRole('article');
  await expect(pathCards.getByText('Sin iniciar', { exact: true })).toHaveCount(2);
  await topics(page, { path: 'Camino a la automatización' });
  await expect(page.getByText('0% · 0 / 12 ejercicios aprobados', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ver evaluación final', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu resultado: 1 de 2', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Todas las rutas', exact: true }).click();
  await topics(page, { course: 'Python Práctica' });
  await page.getByRole('button', { name: 'Comenzar evaluación final', exact: true }).click();
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
  await page.getByRole('group').nth(0).getByRole('radio', { name: 'Dos', exact: true }).check();
  await page.getByRole('group').nth(1).getByRole('radio', { name: 'Dos', exact: true }).check();
  await page.getByRole('button', { name: 'Ver resultado', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu resultado: 2 de 2', exact: true })).toBeVisible();
  const reopened = await context.newPage();
  await page.close();
  await reopened.goto('/');
  await topics(reopened);
  await reopened.getByRole('button', { name: 'Ver evaluación final', exact: true }).click();
  await expect(reopened.getByRole('heading', { name: 'Tu resultado: 1 de 2', exact: true })).toBeVisible();
  await reopened.getByRole('button', { name: 'Todas las rutas', exact: true }).click();
  await topics(reopened, { course: 'Python Práctica' });
  await reopened.getByRole('button', { name: 'Ver evaluación final', exact: true }).click();
  await expect(reopened.getByRole('heading', { name: 'Tu resultado: 2 de 2', exact: true })).toBeVisible();
});

test('unsubmitted answers and legacy assessments are not restored; courses without assessment offer none', async ({ page, context }) => {
  await serveCatalog(context, assessmentPublication());
  await page.addInitScript(() => localStorage.setItem('python-tutor.progress.v1', JSON.stringify({
    assessmentResult: { answers: { valor: 'dos', salida: 'tres' }, score: 1, total: 2 },
  })));
  await page.goto('/');
  await topics(page);
  await page.getByRole('button', { name: 'Comenzar evaluación final', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ver resultado', exact: true })).toBeDisabled();
  await page.getByRole('radio', { name: 'Dos', exact: true }).first().check();
  await page.getByRole('button', { name: 'Volver a temas', exact: true }).click();
  await page.getByRole('button', { name: 'Comenzar evaluación final', exact: true }).click();
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
  await page.getByRole('radio', { name: 'Dos', exact: true }).first().check();
  await page.reload();
  await topics(page);
  await page.getByRole('button', { name: 'Comenzar evaluación final', exact: true }).click();
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Todas las rutas', exact: true }).click();
  await topics(page, { course: 'Python Práctica' });
  await expect(page.getByRole('button', { name: /evaluación final/ })).toHaveCount(0);
});

test('storage failure reports a session-only assessment result that disappears on reload', async ({ page, context }) => {
  await serveCatalog(context, assessmentPublication());
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('python-tutor:course-progress:v1:')) throw new DOMException('Blocked', 'QuotaExceededError');
      return setItem.call(this, key, value);
    };
  });
  await page.goto('/');
  await topics(page);
  await submit(page);
  await expect(page.getByText('No se pudo guardar el progreso en este navegador. Tu avance solo está disponible en esta sesión.', { exact: true })).toBeVisible();
  await page.reload();
  await topics(page);
  await page.getByRole('button', { name: 'Comenzar evaluación final', exact: true }).click();
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /Tu resultado:/ })).toHaveCount(0);
});
