import { test, expect, publication, serveCatalog, updateCourse } from './fixtures/catalog.js';

test.use({ ignoreHTTPSErrors: true });

test('conserva el objetivo al cancelar una propuesta personal', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Crear ruta personal' }).click();
  await page.getByLabel('Objetivo de aprendizaje').fill('Automatizar informes');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByText('Automatizar informes', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar generación' }).click();
  await expect(page.getByLabel('Objetivo de aprendizaje')).toHaveValue('Automatizar informes');
});

test('recupera el objetivo al recargar y espera continuación explícita', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Crear ruta personal' }).click();
  await page.getByLabel('Objetivo de aprendizaje').fill('Aprender a procesar datos');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cancelar generación' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Crear ruta personal' }).click();
  await expect(page.getByLabel('Objetivo de aprendizaje')).toHaveValue('Aprender a procesar datos');
  await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeVisible();
});

test('conversa usando la configuración del tutor antes de ofrecer aprobar', async ({ page }) => {
  const { model, frame } = await import('./fixtures/tutor.js');
  const requests = [];
  await page.addInitScript((config) => localStorage.setItem('python-tutor-access-v1', JSON.stringify(config)), { key: 'sk-or-fictitious', model });
  await page.route('https://openrouter.ai/api/v1/**', async route => {
    if (route.request().url().endsWith('/chat/completions')) {
      requests.push(route.request().postDataJSON());
      await route.fulfill({ contentType: 'text/event-stream', body: frame('¿Qué experiencia tienes con Python?') + frame('', 'stop') + 'data: [DONE]\n\n' });
    } else await route.fulfill({ json: { data: route.request().url().endsWith('/key') ? {} : [model] } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Crear ruta personal' }).click();
  await page.getByLabel('Objetivo de aprendizaje').fill('Automatizar informes');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByText('¿Qué experiencia tienes con Python?')).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0].model).toBe(model.id);
  expect(JSON.stringify(requests[0].messages)).toContain('Automatizar informes');
});

test('cancelar interrumpe la llamada en curso', async ({ page }) => {
  const { model } = await import('./fixtures/tutor.js');
  const { streamingOpenRouter } = await import('./fixtures/openrouter.js');
  await page.addInitScript((config) => localStorage.setItem('python-tutor-access-v1', JSON.stringify(config)), { key: 'sk-or-fictitious', model });
  await page.route('https://openrouter.ai/api/v1/**', async route => {
    await route.fulfill({ json: { data: route.request().url().endsWith('/key') ? {} : [model] } });
  });
  const server = await streamingOpenRouter(page);
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Crear ruta personal' }).click();
    await page.getByLabel('Objetivo de aprendizaje').fill('Aprender Python');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect.poll(() => server.requests.length).toBe(1);
    await page.getByRole('button', { name: 'Cancelar generación' }).click();
    await expect.poll(() => server.closed).toBe(1);
    await expect(page.getByLabel('Objetivo de aprendizaje')).toHaveValue('Aprender Python');
  } finally { await server.close(); }
});

test('continúa la conversación del generador y la recupera tras recargar', async ({ page }) => {
  const { model, frame } = await import('./fixtures/tutor.js');
  const requests = [];
  await page.addInitScript((config) => localStorage.setItem('python-tutor-access-v1', JSON.stringify(config)), { key: 'sk-or-fictitious', model });
  await page.route('https://openrouter.ai/api/v1/**', async route => {
    if (route.request().url().endsWith('/chat/completions')) {
      requests.push(route.request().postDataJSON());
      const answer = requests.length === 1 ? '¿Qué experiencia tienes?' : '¿Qué resultado deseas conseguir?';
      await route.fulfill({ contentType: 'text/event-stream', body: frame(answer) + frame('', 'stop') + 'data: [DONE]\n\n' });
    } else await route.fulfill({ json: { data: route.request().url().endsWith('/key') ? {} : [model] } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Crear ruta personal' }).click();
  await page.getByLabel('Objetivo de aprendizaje').fill('Automatizar informes');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByText('¿Qué experiencia tienes?')).toBeVisible();
  await page.getByLabel('Mensaje al generador').fill('Conozco variables');
  await page.getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(page.getByText('¿Qué resultado deseas conseguir?')).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(JSON.stringify(requests[1].messages)).toContain('Conozco variables');
  await page.reload();
  await page.getByRole('button', { name: 'Crear ruta personal' }).click();
  await expect(page.getByText('¿Qué resultado deseas conseguir?')).toBeVisible();
  expect(requests).toHaveLength(2);
});

test('exige dos aprobaciones y muestra solo el temario de originales disponibles', async ({ page }) => {
  const { model, frame } = await import('./fixtures/tutor.js');
  const requests = [];
  await page.addInitScript((config) => localStorage.setItem('python-tutor-access-v1', JSON.stringify(config)), { key: 'sk-or-fictitious', model });
  await page.route('https://openrouter.ai/api/v1/**', async route => {
    if (route.request().url().endsWith('/chat/completions')) {
      requests.push(route.request().postDataJSON());
      const answer = requests.length === 1 ? '¿Qué experiencia tienes?' : JSON.stringify({ title: 'Mi ruta', description: 'Aprender Python', courseIds: ['python-fundamentos'] });
      await route.fulfill({ contentType: 'text/event-stream', body: frame(answer) + frame('', 'stop') + 'data: [DONE]\n\n' });
    } else await route.fulfill({ json: { data: route.request().url().endsWith('/key') ? {} : [model] } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Crear ruta personal' }).click();
  await page.getByLabel('Objetivo de aprendizaje').fill('Aprender Python');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByText('¿Qué experiencia tienes?')).toBeVisible();
  await page.getByRole('button', { name: 'Preparar generación' }).click();
  await expect(page.getByText(/150 llamadas/)).toBeVisible();
  expect(requests).toHaveLength(1);
  await page.getByRole('button', { name: 'Aprobar generación' }).click();
  await expect(page.getByRole('heading', { name: 'Mi ruta' })).toBeVisible();
  await expect(page.getByText('Python Fundamentos', { exact: true })).toBeVisible();
  await expect(page.getByText('Escribe nombre =', { exact: false })).toHaveCount(0);
  await page.getByRole('button', { name: 'Incorporar ruta' }).click();
  await expect(page.getByRole('heading', { name: 'Mi ruta' })).toBeVisible();
  await expect(page.getByText('Personal', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Explorar Mi ruta' })).toBeVisible();
  await page.getByRole('button', { name: 'Explorar Mi ruta' }).click();
  await expect(page.getByRole('heading', { name: 'Python Fundamentos', exact: true })).toBeVisible();
});

test('reintenta el guardado aprobado sin duplicar la ruta', async ({ page }) => {
  const { model, frame } = await import('./fixtures/tutor.js');
  let calls = 0;
  await page.addInitScript((config) => localStorage.setItem('python-tutor-access-v1', JSON.stringify(config)), { key: 'sk-or-fictitious', model });
  await page.route('https://openrouter.ai/api/v1/**', async route => {
    if (route.request().url().endsWith('/chat/completions')) {
      const answer = ++calls === 1 ? '¿Qué experiencia tienes?' : JSON.stringify({ title: 'Ruta recuperable', description: 'Aprender Python', courseIds: ['python-fundamentos'] });
      await route.fulfill({ contentType: 'text/event-stream', body: frame(answer) + frame('', 'stop') + 'data: [DONE]\n\n' });
    } else await route.fulfill({ json: { data: route.request().url().endsWith('/key') ? {} : [model] } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Crear ruta personal' }).click();
  await page.getByLabel('Objetivo de aprendizaje').fill('Aprender Python');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByText('¿Qué experiencia tienes?')).toBeVisible();
  await page.getByRole('button', { name: 'Preparar generación' }).click();
  await page.getByRole('button', { name: 'Aprobar generación' }).click();
  await expect(page.getByRole('button', { name: 'Incorporar ruta' })).toBeVisible();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'python-tutor:learner-store:v1' && value.includes('python-tutor:personal-paths:v1')) {
        Storage.prototype.setItem = original;
        throw new DOMException('Quota', 'QuotaExceededError');
      }
      return original.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Incorporar ruta' }).click();
  await expect(page.getByRole('alert')).toContainText('No se pudo guardar la ruta');
  await page.getByRole('button', { name: 'Reintentar guardado' }).click();
  await expect(page.getByRole('button', { name: 'Explorar Ruta recuperable' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Explorar Ruta recuperable' })).toHaveCount(1);
  expect(calls).toBe(2);
});

test('cancelar una propuesta invalida su aprobación incluso tras recargar', async ({ page }) => {
  const { model, frame } = await import('./fixtures/tutor.js');
  let calls = 0;
  await page.addInitScript((config) => localStorage.setItem('python-tutor-access-v1', JSON.stringify(config)), { key: 'sk-or-fictitious', model });
  await page.route('https://openrouter.ai/api/v1/**', async route => {
    if (route.request().url().endsWith('/chat/completions')) {
      const answer = ++calls === 1 ? '¿Qué experiencia tienes?' : JSON.stringify({ title: 'Ruta descartada', description: 'Aprender Python', courseIds: ['python-fundamentos'] });
      await route.fulfill({ contentType: 'text/event-stream', body: frame(answer) + frame('', 'stop') + 'data: [DONE]\n\n' });
    } else await route.fulfill({ json: { data: route.request().url().endsWith('/key') ? {} : [model] } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Crear ruta personal' }).click();
  await page.getByLabel('Objetivo de aprendizaje').fill('Aprender Python');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByText('¿Qué experiencia tienes?')).toBeVisible();
  await page.getByRole('button', { name: 'Preparar generación' }).click();
  await page.getByRole('button', { name: 'Aprobar generación' }).click();
  await expect(page.getByRole('heading', { name: 'Ruta descartada' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar generación' }).click();
  await expect(page.getByLabel('Objetivo de aprendizaje')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Crear ruta personal' }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ruta descartada' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Preparar generación' })).toBeVisible();
});

test('conserva una copia íntegra del original cuando se retira de la publicación', async ({ page, context }) => {
  const { model, frame } = await import('./fixtures/tutor.js');
  let calls = 0;
  await page.addInitScript((config) => localStorage.setItem('python-tutor-access-v1', JSON.stringify(config)), { key: 'sk-or-fictitious', model });
  await page.route('https://openrouter.ai/api/v1/**', async route => {
    if (route.request().url().endsWith('/chat/completions')) {
      const answer = ++calls === 1 ? '¿Qué experiencia tienes?' : JSON.stringify({ title: 'Ruta conservada', description: 'Aprender Python', courseIds: ['python-fundamentos'] });
      await route.fulfill({ contentType: 'text/event-stream', body: frame(answer) + frame('', 'stop') + 'data: [DONE]\n\n' });
    } else await route.fulfill({ json: { data: route.request().url().endsWith('/key') ? {} : [model] } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Crear ruta personal' }).click();
  await page.getByLabel('Objetivo de aprendizaje').fill('Aprender Python');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByText('¿Qué experiencia tienes?')).toBeVisible();
  await page.getByRole('button', { name: 'Preparar generación' }).click();
  await page.getByRole('button', { name: 'Aprobar generación' }).click();
  await page.getByRole('button', { name: 'Incorporar ruta' }).click();
  await expect(page.getByRole('button', { name: 'Explorar Ruta conservada' })).toBeVisible();
  const revised = publication('fixture-2');
  revised.catalog.courses = revised.catalog.courses.filter(course => course.id !== 'python-fundamentos');
  revised.catalog.learningPaths = revised.catalog.learningPaths.map(path => ({ ...path, courseIds: path.courseIds.filter(id => id !== 'python-fundamentos') })).filter(path => path.courseIds.length);
  await serveCatalog(context, revised);
  await page.reload();
  await page.getByRole('button', { name: 'Recargar para actualizar' }).click();
  await page.getByRole('button', { name: 'Explorar Ruta conservada' }).click();
  await expect(page.getByRole('heading', { name: 'Python Fundamentos', exact: true })).toBeVisible();
  await expect(page.getByText('Original retirado', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ver temas de Python Fundamentos' }).click();
  await expect(page.getByRole('button', { name: /Comenzar curso/ })).toBeVisible();
});

test('bloquea otra llamada si el consumo de la generación no se pudo confirmar', async ({ page }) => {
  const { model, frame } = await import('./fixtures/tutor.js');
  let calls = 0;
  await page.addInitScript((config) => localStorage.setItem('python-tutor-access-v1', JSON.stringify(config)), { key: 'sk-or-fictitious', model });
  await page.route('https://openrouter.ai/api/v1/**', async route => {
    if (route.request().url().endsWith('/chat/completions')) {
      const answer = ++calls === 1 ? '¿Qué experiencia tienes?' : 'Respuesta incompatible';
      await route.fulfill({ contentType: 'text/event-stream', body: frame(answer) + frame('', 'stop') + 'data: [DONE]\n\n' });
    } else await route.fulfill({ json: { data: route.request().url().endsWith('/key') ? {} : [model] } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Crear ruta personal' }).click();
  await page.getByLabel('Objetivo de aprendizaje').fill('Aprender Python');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByText('¿Qué experiencia tienes?')).toBeVisible();
  await page.getByRole('button', { name: 'Preparar generación' }).click();
  await page.getByRole('button', { name: 'Aprobar generación' }).click();
  await expect(page.getByText(/consumo pendiente de confirmar/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reintentar generación' })).toBeDisabled();
  expect(calls).toBe(2);
  await page.reload();
  await page.getByRole('button', { name: 'Crear ruta personal' }).click();
  await expect(page.getByText(/consumo pendiente de confirmar/i)).toBeVisible();
});

test('otra pestaña no controla el generador mientras la primera conserva el control', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Crear ruta personal' }).click();
  await expect(page.getByLabel('Objetivo de aprendizaje')).toBeVisible();
  const other = await context.newPage();
  await other.goto('/');
  await other.getByRole('button', { name: 'Crear ruta personal' }).click();
  await expect(other.getByText(/otra pestaña controla el generador/i)).toBeVisible();
  await expect(other.getByRole('button', { name: 'Continuar', exact: true })).toHaveCount(0);
  await page.close();
  await other.getByRole('button', { name: 'Recuperar control' }).click();
  await expect(other.getByLabel('Objetivo de aprendizaje')).toBeVisible();
});

test('conserva la última versión válida del original antes de su retirada', async ({ page, context }) => {
  const { model, frame } = await import('./fixtures/tutor.js');
  let calls = 0;
  await page.addInitScript((config) => localStorage.setItem('python-tutor-access-v1', JSON.stringify(config)), { key: 'sk-or-fictitious', model });
  await page.route('https://openrouter.ai/api/v1/**', async route => {
    if (route.request().url().endsWith('/chat/completions')) {
      const answer = ++calls === 1 ? '¿Qué experiencia tienes?' : JSON.stringify({ title: 'Ruta actualizada', description: 'Aprender Python', courseIds: ['python-fundamentos'] });
      await route.fulfill({ contentType: 'text/event-stream', body: frame(answer) + frame('', 'stop') + 'data: [DONE]\n\n' });
    } else await route.fulfill({ json: { data: route.request().url().endsWith('/key') ? {} : [model] } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Crear ruta personal' }).click();
  await page.getByLabel('Objetivo de aprendizaje').fill('Aprender Python');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByText('¿Qué experiencia tienes?')).toBeVisible();
  await page.getByRole('button', { name: 'Preparar generación' }).click();
  await page.getByRole('button', { name: 'Aprobar generación' }).click();
  await page.getByRole('button', { name: 'Incorporar ruta' }).click();
  await expect(page.getByRole('button', { name: 'Explorar Ruta actualizada' })).toBeVisible();
  const updated = publication('fixture-2');
  updateCourse(updated, 'python-fundamentos', course => { course.title = 'Python actualizado'; });
  await serveCatalog(context, updated);
  await page.reload();
  await page.getByRole('button', { name: 'Recargar para actualizar' }).click();
  await page.getByRole('button', { name: 'Explorar Ruta actualizada' }).click();
  await expect(page.getByRole('heading', { name: 'Python actualizado' })).toBeVisible();
  const retired = publication('fixture-3');
  retired.catalog.courses = retired.catalog.courses.filter(course => course.id !== 'python-fundamentos');
  retired.catalog.learningPaths = retired.catalog.learningPaths.map(path => ({ ...path, courseIds: path.courseIds.filter(id => id !== 'python-fundamentos') })).filter(path => path.courseIds.length);
  await serveCatalog(context, retired);
  await page.reload();
  await page.getByRole('button', { name: 'Recargar para actualizar' }).click();
  await page.getByRole('button', { name: 'Explorar Ruta actualizada' }).click();
  await expect(page.getByRole('heading', { name: 'Python actualizado' })).toBeVisible();
});

test('requiere continuar o descartar la propuesta pendiente antes de cambiar de objetivo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Crear ruta personal' }).click();
  await page.getByLabel('Objetivo de aprendizaje').fill('Primer objetivo');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: 'Cancelar generación' }).click();
  await expect(page.getByLabel('Objetivo de aprendizaje')).toHaveAttribute('readonly', '');
  await page.getByRole('button', { name: 'Descartar propuesta' }).click();
  await expect(page.getByLabel('Objetivo de aprendizaje')).toBeEditable();
  await expect(page.getByLabel('Objetivo de aprendizaje')).toHaveValue('');
});

test('permite ajustar el presupuesto antes de aprobar y detiene una llamada sin margen', async ({ page }) => {
  const { model, frame } = await import('./fixtures/tutor.js');
  let calls = 0;
  await page.addInitScript((config) => localStorage.setItem('python-tutor-access-v1', JSON.stringify(config)), { key: 'sk-or-fictitious', model });
  await page.route('https://openrouter.ai/api/v1/**', async route => {
    if (route.request().url().endsWith('/chat/completions')) {
      calls++;
      await route.fulfill({ contentType: 'text/event-stream', body: frame('¿Qué experiencia tienes?') + frame('', 'stop') + 'data: [DONE]\n\n' });
    } else await route.fulfill({ json: { data: route.request().url().endsWith('/key') ? {} : [model] } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Crear ruta personal' }).click();
  await page.getByLabel('Objetivo de aprendizaje').fill('Aprender Python');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByText('¿Qué experiencia tienes?')).toBeVisible();
  await page.getByRole('button', { name: 'Preparar generación' }).click();
  await page.getByLabel('Límite de tokens').fill('500');
  await page.getByRole('button', { name: 'Aprobar generación' }).click();
  await expect(page.getByRole('alert')).toContainText('presupuesto');
  expect(calls).toBe(1);
});

test('confirma el consumo desconocido antes de reintentar el mismo trabajo', async ({ page }) => {
  const { model, frame } = await import('./fixtures/tutor.js');
  let calls = 0;
  await page.addInitScript((config) => localStorage.setItem('python-tutor-access-v1', JSON.stringify(config)), { key: 'sk-or-fictitious', model });
  await page.route('https://openrouter.ai/api/v1/**', async route => {
    if (route.request().url().endsWith('/chat/completions')) {
      const answer = ++calls === 1 ? '¿Qué experiencia tienes?' : 'Respuesta incompatible';
      await route.fulfill({ contentType: 'text/event-stream', body: frame(answer) + frame('', 'stop') + 'data: [DONE]\n\n' });
    } else await route.fulfill({ json: { data: route.request().url().endsWith('/key') ? {} : [model] } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Crear ruta personal' }).click();
  await page.getByLabel('Objetivo de aprendizaje').fill('Aprender Python');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByText('¿Qué experiencia tienes?')).toBeVisible();
  await page.getByRole('button', { name: 'Preparar generación' }).click();
  await page.getByRole('button', { name: 'Aprobar generación' }).click();
  await expect(page.getByText(/consumo pendiente de confirmar/i)).toBeVisible();
  await page.getByLabel('Tokens consumidos en la llamada').fill('250');
  await page.getByRole('button', { name: 'Confirmar consumo' }).click();
  await expect(page.getByText(/consumo pendiente de confirmar/i)).toHaveCount(0);
  await page.getByRole('button', { name: 'Reintentar generación' }).click();
  await expect.poll(() => calls).toBe(3);
});

test('conserva el consumo pendiente después de incorporar la ruta', async ({ page }) => {
  const { model, frame } = await import('./fixtures/tutor.js');
  let calls = 0;
  await page.addInitScript((config) => localStorage.setItem('python-tutor-access-v1', JSON.stringify(config)), { key: 'sk-or-fictitious', model });
  await page.route('https://openrouter.ai/api/v1/**', async route => {
    if (route.request().url().endsWith('/chat/completions')) {
      const answer = ++calls === 1 ? '¿Qué experiencia tienes?' : JSON.stringify({ title: 'Ruta con consumo pendiente', description: 'Aprender Python', courseIds: ['python-fundamentos'] });
      await route.fulfill({ contentType: 'text/event-stream', body: frame(answer) + frame('', 'stop') + 'data: [DONE]\n\n' });
    } else await route.fulfill({ json: { data: route.request().url().endsWith('/key') ? {} : [model] } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Crear ruta personal' }).click();
  await page.getByLabel('Objetivo de aprendizaje').fill('Aprender Python');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByText('¿Qué experiencia tienes?')).toBeVisible();
  await page.getByRole('button', { name: 'Preparar generación' }).click();
  await page.getByRole('button', { name: 'Aprobar generación' }).click();
  await page.getByRole('button', { name: 'Incorporar ruta' }).click();
  await expect(page.getByRole('button', { name: 'Explorar Ruta con consumo pendiente' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Crear ruta personal' }).click();
  await expect(page.getByText(/consumo pendiente de confirmar/i)).toBeVisible();
  await page.getByLabel('Objetivo de aprendizaje').fill('Otro objetivo');
  await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeDisabled();
  expect(calls).toBe(2);
});
