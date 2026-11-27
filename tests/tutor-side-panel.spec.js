import { test, expect, enterCourse } from './fixtures/catalog.js';

test('el tutor se abre sin salir de la lección y devuelve el foco al cerrar', async ({ page }) => {
  await page.goto('/');
  await enterCourse(page);
  const opener = page.getByRole('button', { name: 'Tutor IA' });
  await opener.click();
  const close = page.getByRole('button', { name: 'Cerrar Tutor' });
  await expect(close).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Lección' })).toHaveAttribute('aria-selected', 'true');
  const settings = page.getByRole('button', { name: 'Configuración del tutor' });
  await settings.click();
  await page.keyboard.press('Escape');
  await expect(settings).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
});

import { model, frame } from './fixtures/tutor.js';

test('conserva el borrador por tema y envía la captura de la lección', async ({ page }) => {
  const requests = [];
  await page.route('https://openrouter.ai/api/v1/**', async route => {
    if (route.request().url().endsWith('/chat/completions')) {
      requests.push(route.request().postDataJSON());
      await route.fulfill({ contentType: 'text/event-stream', body: frame('Una pista') + frame('', 'stop') + 'data: [DONE]\n\n' });
    } else await route.fulfill({ json: { data: route.request().url().endsWith('/key') ? {} : [model] } });
  });
  await page.goto('/');
  await enterCourse(page);
  await page.getByRole('button', { name: 'Tutor IA' }).click();
  await page.getByRole('button', { name: 'Configuración del tutor' }).click();
  await page.getByLabel('Clave de OpenRouter').fill('sk-or-fictitious');
  await page.getByRole('button', { name: 'Validar clave' }).click();
  await page.getByRole('button', { name: /Tutor de prueba/ }).click();
  await page.getByRole('button', { name: 'Guardar y volver al tutor' }).click();
  const message = page.getByLabel('Mensaje al tutor');
  await expect(message).toBeFocused();
  await message.fill('Explícame la lección');
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(page.getByText('Respuesta completa', { exact: true })).toBeVisible();
  const capture = JSON.parse(requests[0].messages.at(-1).content).capture;
  expect(capture.topic.id).toBe('valores-variables');
  expect(capture.exercise).toBeUndefined();
  await message.fill('borrador del primer tema');
  await page.getByRole('button', { name: /02 Expresiones y salida/ }).click();
  await expect(message).toHaveValue('');
  await message.fill('borrador del segundo tema');
  await page.getByRole('button', { name: /01 Valores y variables/ }).click();
  await expect(message).toHaveValue('borrador del primer tema');
  await expect(page.getByText('Una pista', { exact: true })).toBeVisible();
  await page.reload();
  await enterCourse(page);
  await page.getByRole('button', { name: 'Tutor IA' }).click();
  await expect(page.getByText('Una pista', { exact: true })).toBeVisible();
});

test('en móvil el tutor ocupa la pantalla y mantiene el foco dentro', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await enterCourse(page);
  await page.getByRole('button', { name: 'Tutor IA' }).click();
  const dialog = page.getByRole('dialog', { name: 'Tutor IA' });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box.width).toBe(390);
  expect(box.height).toBe(844);
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Tutor IA' })).toBeFocused();
});

import { setup } from './fixtures/tutor.js';
import { streamingOpenRouter } from './fixtures/openrouter.js';
test.use({ ignoreHTTPSErrors: true });
test('la respuesta continúa en su tema al cerrar y cambiar de tema', async ({ page }) => {
  await setup(page);
  const server = await streamingOpenRouter(page);
  try {
    await page.getByLabel('Mensaje al tutor').fill('Pregunta de origen');
    await page.getByRole('button', { name: 'Enviar', exact: true }).click();
    await expect.poll(() => server.responses.length).toBe(1);
    server.responses[0].write(frame('Respuesta de origen'));
    await expect(page.getByText('Respuesta de origen', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar Tutor' }).click();
    await page.getByRole('button', { name: /02 Expresiones y salida/ }).click();
    server.responses[0].end(frame('', 'stop') + 'data: [DONE]\n\n');
    await page.getByRole('button', { name: 'Tutor IA' }).click();
    await expect(page.getByText('Pregunta de origen', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: /01 Valores y variables/ }).click();
    await expect(page.getByText('Respuesta completa', { exact: true })).toBeVisible();
    await expect(page.getByText('Respuesta de origen', { exact: true })).toBeVisible();
  } finally { await server.close(); }
});
