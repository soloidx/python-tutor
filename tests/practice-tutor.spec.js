import { test, expect, publication, updateCourse, serveCatalog } from './fixtures/catalog.js';
import { setup, model, frame } from './fixtures/tutor.js';

test.use({ ignoreHTTPSErrors: true });

function tutorPublication(revision = 'practice-tutor') {
  const value = publication(revision);
  updateCourse(value, 'python-fundamentos', course => {
    const topic = course.topics[0];
    course.topics = [topic];
    topic.exercises[0].hints = ['INTERNAL_HINT_SOLUTION'];
    const choice = topic.exercises[1];
    Object.assign(choice, { type: 'choice', title: 'Selección del tema', prompt: '¿Qué guarda edad?', code: 'edad = 7', options: [{ id: 'seven', text: 'Guarda siete' }, { id: 'other', text: 'Guarda otra cosa' }], answerId: 'seven', retry: 'Revisa la asignación', explanation: 'Guarda el valor siete', hints: ['INTERNAL_CHOICE_HINT'] });
    delete choice.starter; delete choice.check; delete choice.success;
  });
  updateCourse(value, 'python-practica', course => {
    course.topics = [course.topics[0]];
    course.topics[0].exercises = [{ ...course.topics[0].exercises[0], id: 'other-course-code', title: 'Otro curso' }];
  });
  return value;
}
const practice = page => page.getByRole('button', { name: 'Práctica', exact: true });
const rail = page => page.getByRole('navigation', { name: 'Ejercicios de la ronda' });
async function send(page, message) {
  await page.getByLabel('Mensaje al tutor').fill(message);
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
}

test('practice shares the course topic conversation and safely captures selection context', async ({ page, context }) => {
  await serveCatalog(context, tutorPublication());
  const requests = await setup(page);
  await send(page, 'Pregunta desde el curso');
  await expect(page.getByText('Respuesta completa', { exact: true })).toHaveCount(1);
  await practice(page).click();
  await rail(page).getByRole('button', { name: /Selección del tema/ }).click();
  await expect(page.getByText('Pregunta desde el curso', { exact: true })).toBeVisible();
  await page.getByLabel('Guarda otra cosa', { exact: true }).check();
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await send(page, 'Pregunta desde selección');
  await expect(page.getByText('Respuesta completa', { exact: true })).toHaveCount(2);
  const captured = JSON.parse(requests[1].messages.at(-1).content).capture;
  expect(captured).toMatchObject({ exercise: { type: 'choice', code: 'edad = 7', options: [{ id: 'seven', text: 'Guarda siete' }, { id: 'other', text: 'Guarda otra cosa' }] }, selectedOptionId: 'other', selectionStatus: 'checked', lastResult: { optionId: 'other', correct: false }, feedback: 'Revisa la asignación' });
  expect(JSON.stringify(requests)).not.toMatch(/INTERNAL_|answerId|"check"/);
  await rail(page).getByRole('button', { name: /Otro curso/ }).click();
  await expect(page.getByText('Pregunta desde el curso', { exact: true })).toHaveCount(0);
  await send(page, 'Pregunta del otro curso');
  await expect(page.getByText('Respuesta completa', { exact: true })).toHaveCount(1);
  expect(requests[2].messages).toHaveLength(2);
  await rail(page).getByRole('button', { name: /Selección del tema/ }).click();
  await expect(page.getByText('Pregunta desde selección', { exact: true })).toBeVisible();
});

test('practice tutor captures only the current choice check result', async ({ page, context }) => {
  await serveCatalog(context, tutorPublication());
  const requests = await setup(page);
  await practice(page).click();
  await rail(page).getByRole('button', { name: /Selección del tema/ }).click();

  await page.getByLabel('Guarda otra cosa', { exact: true }).check();
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await page.getByLabel('Guarda siete', { exact: true }).check();
  await send(page, 'Revisa mi nueva selección');
  await expect(page.getByText('Respuesta completa', { exact: true })).toHaveCount(1);
  const pending = JSON.parse(requests[0].messages.at(-1).content).capture;
  expect(pending).toMatchObject({
    selectedOptionId: 'seven',
    selectionStatus: 'pending',
    lastResult: null,
    feedback: null,
  });

  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await send(page, 'Revisa mi selección comprobada');
  await expect(page.getByText('Respuesta completa', { exact: true })).toHaveCount(2);
  const checked = JSON.parse(requests[1].messages.at(-1).content).capture;
  expect(checked).toMatchObject({
    selectedOptionId: 'seven',
    selectionStatus: 'checked',
    lastResult: { optionId: 'seven', correct: true },
    feedback: 'Guarda el valor siete',
  });
});

test('resolved choice entries keep their accepted answer available for review', async ({ page, context }) => {
  await serveCatalog(context, tutorPublication());
  await page.goto('/');
  await practice(page).click();
  const choice = rail(page).getByRole('button', { name: /Selección del tema/ });
  await choice.click();
  await page.getByLabel('Guarda siete', { exact: true }).check();
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(page.getByLabel('Progreso de la ronda')).toHaveAttribute('value', '1');
  await expect(page.getByLabel('Guarda siete', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Guarda otra cosa', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Comprobar', exact: true })).toBeDisabled();
  await expect(page.locator('.choice-feedback')).toContainText('Guarda el valor siete');
  await expect(page.getByText('Ejercicio aprobado')).toBeVisible();
});

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`practice returns from settings and retries original code and selection captures at ${viewport.width}px`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    await serveCatalog(context, tutorPublication());
    const requests = await setup(page, model, 'Respuesta parcial', 'length');
    await practice(page).click();
    await rail(page).getByRole('button', { name: /Tu primera variable/ }).click();
    await page.getByRole('button', { name: 'Configuración del tutor', exact: true }).click();
    await page.getByRole('button', { name: 'Validar clave', exact: true }).click();
    await page.getByRole('button', { name: 'Guardar y volver al tutor' }).click();
    await expect(practice(page)).toHaveAttribute('aria-current', 'page');
    await expect(page.getByLabel('Mensaje al tutor')).toBeFocused();
    await page.getByLabel('Código Python').fill('print("ejecución original")');
    await page.getByRole('button', { name: 'Ejecutar', exact: true }).click();
    await expect(page.getByLabel('Salida del programa')).toHaveText('ejecución original');
    await page.getByLabel('Código Python').fill('# borrador posterior');
    await send(page, 'Revisa mi código');
    await expect(page.getByText(/límite de salida/)).toHaveCount(1);
    const codeRequest = structuredClone(requests[0]);
    expect(JSON.parse(codeRequest.messages.at(-1).content).capture).toMatchObject({
      draft: '# borrador posterior',
      lastResult: { previous: true, code: 'print("ejecución original")', output: 'ejecución original' },
    });
    await page.getByLabel('Código Python').fill('# captura no debe cambiar');
    await rail(page).getByRole('button', { name: /Selección del tema/ }).click();
    await page.getByLabel('Guarda otra cosa', { exact: true }).check();
    await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
    await send(page, 'Revisa mi selección');
    await expect(page.getByText(/límite de salida/)).toHaveCount(2);
    const choiceRequest = structuredClone(requests[1]);
    await page.getByLabel('Guarda siete', { exact: true }).check();
    await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
    await page.reload();
    await practice(page).click();
    await expect(page.getByRole('button', { name: 'Reintentar respuesta', exact: true })).toHaveCount(2);
    await page.route('https://openrouter.ai/api/v1/chat/completions', route => {
      requests.push(route.request().postDataJSON());
      return route.fulfill({ contentType: 'text/event-stream', body: frame('Respuesta recuperada') + frame('', 'stop') + 'data: [DONE]\n\n' });
    });
    await page.getByRole('button', { name: 'Reintentar respuesta', exact: true }).nth(1).click();
    await expect(page.getByText('Respuesta recuperada', { exact: true })).toHaveCount(1);
    expect(requests[2]).toEqual(choiceRequest);
    await page.getByRole('button', { name: 'Reintentar respuesta', exact: true }).click();
    await expect(page.getByText('Respuesta recuperada', { exact: true })).toHaveCount(2);
    expect(requests[3]).toEqual(codeRequest);
    expect(JSON.stringify(requests)).not.toMatch(/INTERNAL_|answerId|"check"/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/practice-tutor-${viewport.width}.png`, fullPage: true });
  });
}

test('practice isolates topic conversations and keeps them when drawing another round', async ({ page, context }) => {
  const value = tutorPublication();
  updateCourse(value, 'python-fundamentos', course => {
    const topic = structuredClone(course.topics[0]);
    topic.id = 'tema-aislado'; topic.title = 'Tema independiente';
    topic.exercises = [{ ...topic.exercises[0], id: 'ejercicio-aislado', title: 'Actividad de otro tema' }];
    course.topics.push(topic);
  });
  await serveCatalog(context, value);
  const requests = await setup(page);
  await practice(page).click();
  await rail(page).getByRole('button', { name: /Tu primera variable/ }).click();
  await send(page, 'Mensaje del primer tema');
  await expect(page.getByText('Respuesta completa', { exact: true })).toHaveCount(1);
  await rail(page).getByRole('button', { name: /Actividad de otro tema/ }).click();
  await expect(page.getByText('Mensaje del primer tema', { exact: true })).toHaveCount(0);
  await send(page, 'Mensaje del segundo tema');
  await expect(page.getByText('Respuesta completa', { exact: true })).toHaveCount(1);
  expect(requests[1].messages).toHaveLength(2);
  await page.getByRole('button', { name: 'Nueva ronda', exact: true }).click();
  await rail(page).getByRole('button', { name: /Tu primera variable/ }).click();
  await expect(page.getByText('Mensaje del primer tema', { exact: true })).toBeVisible();
  await expect(page.getByText('Mensaje del segundo tema', { exact: true })).toHaveCount(0);
  await rail(page).getByRole('button', { name: /Actividad de otro tema/ }).click();
  await expect(page.getByText('Mensaje del segundo tema', { exact: true })).toBeVisible();
});

function revisionPublication(revision, exerciseId, summary) {
  const value = tutorPublication(revision);
  for (const courseId of ['python-fundamentos', 'python-practica']) {
    updateCourse(value, courseId, course => {
      const original = JSON.parse(value.files[value.catalog.courses[0].file]).topics[0].exercises.find(exercise => exercise.type === 'choice');
      course.topics[0].summary = summary;
      course.topics[0].exercises = [{ ...original, id: exerciseId }];
    });
  }
  return value;
}
async function activateRevision(page, context, value) {
  await serveCatalog(context, value);
  await page.reload();
  await page.getByRole('button', { name: 'Recargar para actualizar', exact: true }).click();
  await practice(page).click();
}

test('topic conversation survives invalidated rounds and completed review keeps its original tutor context', async ({ page, context }) => {
  await serveCatalog(context, revisionPublication('tutor-one', 'first-choice', 'Contenido del tema original'));
  const requests = await setup(page);
  await practice(page).click();
  await page.getByLabel('Guarda otra cosa', { exact: true }).check();
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await send(page, 'Antes de cambiar el catálogo');
  await expect(page.getByText('Respuesta completa', { exact: true })).toHaveCount(1);
  await activateRevision(page, context, revisionPublication('tutor-two', 'second-choice', 'Contenido conservado de la segunda revisión'));
  await expect(page.getByRole('alert')).toContainText('El catálogo cambió');
  await expect(page.getByText('Antes de cambiar el catálogo', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Guarda otra cosa', { exact: true })).not.toBeChecked();
  await send(page, 'Después de invalidar la ronda');
  await expect(page.getByText('Respuesta completa', { exact: true })).toHaveCount(2);
  expect(requests[1].messages[1].content).toContain('Antes de cambiar el catálogo');
  expect(JSON.parse(requests[1].messages.at(-1).content).capture).toMatchObject({ exercise: { id: 'second-choice' }, selectionStatus: 'none' });
  await page.getByLabel('Guarda siete', { exact: true }).check();
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ronda completada', exact: true })).toBeVisible();
  await activateRevision(page, context, revisionPublication('tutor-three', 'third-choice', 'Contenido nuevo que no pertenece a la ronda completada'));
  await page.getByRole('button', { name: 'Revisar ejercicios', exact: true }).click();
  await expect(page.getByText('Antes de cambiar el catálogo', { exact: true })).toBeVisible();
  await expect(page.getByText('Después de invalidar la ronda', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Guarda siete', { exact: true })).toBeDisabled();
  await send(page, 'Revisar la ronda completada');
  await expect(page.getByText('Respuesta completa', { exact: true })).toHaveCount(3);
  const capture = JSON.parse(requests[2].messages.at(-1).content).capture;
  expect(capture).toMatchObject({ topic: { summary: 'Contenido conservado de la segunda revisión' }, exercise: { id: 'second-choice' }, selectedOptionId: 'seven', selectionStatus: 'checked', lastResult: { optionId: 'seven', correct: true }, feedback: 'Guarda el valor siete' });
  expect(JSON.stringify(requests)).not.toMatch(/INTERNAL_|answerId|"check"/);
  await page.getByRole('button', { name: 'Nueva ronda', exact: true }).click();
  await expect(page.getByText('Revisar la ronda completada', { exact: true })).toBeVisible();
  await send(page, 'Ayuda con la nueva ronda');
  await expect(page.getByText('Respuesta completa', { exact: true })).toHaveCount(4);
  expect(JSON.parse(requests[3].messages.at(-1).content).capture).toMatchObject({ topic: { summary: 'Contenido nuevo que no pertenece a la ronda completada' }, exercise: { id: 'third-choice' } });
});
