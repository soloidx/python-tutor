import { test, expect, publication, serveCatalog, updateCourse, enterCourse } from './fixtures/catalog.js';
import { setup } from './fixtures/tutor.js';

test('captures the active lesson and keeps its saved title in the shared topic conversation', async ({ page, context }) => {
  const catalog = publication('tutor-lessons');
  const lessons = [
    { id: 'one', title: 'Primera lección', markdown: '# Primera lección\n\nEjemplo:\n\n```python\nprint(1)\n```' },
    { id: 'two', title: 'Segunda lección', markdown: '# Segunda lección\n\nOtro ejemplo:\n\n```python\nprint(2)\n```' },
  ];
  updateCourse(catalog, 'python-fundamentos', course => {
    const topic = course.topics[0];
    delete topic.explanation; delete topic.example; delete topic.takeaway; delete topic.walkthrough;
    topic.lessons = lessons;
  });
  await serveCatalog(context, catalog);
  const requests = await setup(page);
  await page.getByRole('tab', { name: 'Lección' }).click();
  for (const [index, lesson] of lessons.entries()) {
    if (index) await page.getByRole('button', { name: lesson.title, exact: true }).click();
    await page.getByLabel('Mensaje al tutor').fill(`Pregunta ${index}`);
    await page.getByRole('button', { name: 'Enviar', exact: true }).click();
    await expect(page.getByText('Respuesta completa', { exact: true })).toHaveCount(index + 1);
    const capture = JSON.parse(requests[index].messages.at(-1).content).capture;
    expect(capture.lesson).toEqual(lesson);
    expect(capture).not.toHaveProperty('walkthrough');
    expect(capture.course.id).toContain('python-fundamentos');
  }
  await page.getByRole('tab', { name: /Ejercicios/ }).click();
  await page.getByLabel('Mensaje al tutor').fill('Pregunta ejercicio');
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(page.getByText('Respuesta completa', { exact: true })).toHaveCount(3);
  const exerciseCapture = JSON.parse(requests[2].messages.at(-1).content).capture;
  expect(exerciseCapture).not.toHaveProperty('lesson');
  expect(exerciseCapture.topic).not.toHaveProperty('explanation');
  await page.reload(); await enterCourse(page);
  await page.getByRole('button', { name: 'Tutor IA', exact: true }).click();
  await expect(page.getByText('Primera lección', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Segunda lección', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Pregunta ejercicio', { exact: true })).toBeVisible();
});

test('legacy lesson captures static content without the player state', async ({ page }) => {
  const requests = await setup(page);
  await page.getByRole('tab', { name: 'Lección' }).click();
  await page.getByLabel('Mensaje al tutor').fill('Ayuda con el recorrido');
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(page.getByText('Respuesta completa', { exact: true })).toBeVisible();
  const capture = JSON.parse(requests[0].messages.at(-1).content).capture;
  expect(capture.topic).toMatchObject({ title: 'Valores y variables', explanation: expect.any(Array), example: expect.any(String) });
  expect(capture).not.toHaveProperty('walkthrough');
  expect(capture).not.toHaveProperty('lesson');
});
