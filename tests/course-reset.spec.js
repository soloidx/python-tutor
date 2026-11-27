import { test, expect, enterCourse } from './fixtures/catalog.js';
test.use({ actionTimeout: 8000 });

test('course reset forgets position and shares its empty state across paths', async ({ page }) => {
  await page.goto('/');
  await enterCourse(page);
  if (await page.getByRole('button', { name: 'Cerrar Tutor' }).isVisible()) await page.getByRole('button', { name: 'Cerrar Tutor' }).click();
  await page.getByRole('tab', { name: /Ejercicios/ }).click();
  await page.getByLabel('Código Python').fill('nombre = "Ada"\nprint("Hola, " + nombre)');
  await page.getByRole('button', { name: 'Ejecutar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('¡Correcto!');
  await page.getByRole('button', { name: 'Siguiente tema', exact: true }).click();
  await page.getByRole('button', { name: 'Reiniciar este curso', exact: true }).click();
  const confirmation = page.getByRole('group', { name: 'Confirmar reinicio' });
  await expect(confirmation).toContainText('todas sus rutas');
  await expect(confirmation).toContainText('posición');
  await confirmation.getByRole('button', { name: 'Sí, reiniciar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Comenzar curso', exact: true })).toBeVisible();
  await expect(page.getByText('0% · 0 / 12 ejercicios aprobados', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Todas las rutas', exact: true }).click();
  await page.getByRole('button', { name: 'Explorar Camino a la automatización', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Comenzar Python Fundamentos', exact: true })).toBeVisible();
  await page.reload();
  await enterCourse(page);
  await expect(page.getByRole('heading', { name: 'Valores y variables', exact: true })).toBeVisible();
  await expect(page.getByText('0 / 12 ejercicios', { exact: true })).toBeVisible();
});

async function approve(page) {
  if (await page.getByRole('button', { name: 'Cerrar Tutor' }).isVisible()) await page.getByRole('button', { name: 'Cerrar Tutor' }).click();
  await page.getByRole('tab', { name: /Ejercicios/ }).click();
  await page.getByLabel('Código Python').fill('nombre = "Ada"\nprint("Hola, " + nombre)');
  await page.getByRole('button', { name: 'Ejecutar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('¡Correcto!');
}
async function ask(page, message) {
  await page.getByRole('button', { name: 'Tutor IA', exact: true }).click();
  await page.getByLabel('Mensaje al tutor').fill(message);
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(page.getByText('Respuesta completa', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar Tutor' }).click();
}
async function reset(page, global = false) {
  await page.getByRole('button', { name: global ? 'Reiniciar todo el aprendizaje' : 'Reiniciar este curso', exact: true }).click();
  await page.getByRole('button', { name: 'Sí, reiniciar', exact: true }).click();
}

test('course reset removes retired approvals, assessment, history and recovery copies while preserving other courses and catalog/access', async ({ page }) => {
  const { setup } = await import('./fixtures/tutor.js');
  const requests = await setup(page, undefined, 'Respuesta completa');
  await approve(page);
  await ask(page, 'Conversación del curso compartido');
  await page.getByRole('button', { name: 'Todas las rutas', exact: true }).click();
  await enterCourse(page, { course: 'Python Práctica' });
  await approve(page);
  await ask(page, 'Conversación de otro curso');
  await page.getByRole('button', { name: 'Todas las rutas', exact: true }).click();
  await page.evaluate(() => {
    const key = 'python-tutor:course-progress:v1:%5B%22original%22%2C%22python-fundamentos%22%5D';
    const saved = JSON.parse(window.__learnerTest.getItem(key));
    saved.completed.push('ejercicio-retirado', null);
    saved.assessmentResult = { answers: { retirada: 'opcion-a' } };
    window.__learnerTest.setItem(key, JSON.stringify(saved));
  });
  await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: /recuperación parcial/ })).toBeVisible();
  await enterCourse(page);
  const kept = await page.evaluate(() => Object.fromEntries(window.__learnerTest.entries().filter(([key]) => key.includes('python-practica') || key === 'python-tutor:catalog:v1' || (!key.includes('course-') && !key.includes('recovery:')))));
  await reset(page);
  await expect(page.getByRole('button', { name: 'Comenzar curso', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__learnerTest.keys().filter(key => key.includes('recovery:v1:%5B%22original%22%2C%22python-fundamentos%22%5D:')))).toEqual([]);
  expect(await page.evaluate(() => JSON.parse(window.__learnerTest.getItem('python-tutor:course-progress:v1:%5B%22original%22%2C%22python-fundamentos%22%5D') || 'null'))).toBeNull();
  expect(await page.evaluate(() => JSON.parse(window.__learnerTest.getItem('python-tutor:course-conversations:v1:%5B%22original%22%2C%22python-fundamentos%22%5D') || '[]'))).toEqual([]);
  expect(await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, window.__learnerTest.getItem(key)])), Object.keys(kept))).toEqual(kept);
  await page.getByRole('button', { name: 'Comenzar curso', exact: true }).click();
  await ask(page, 'Después del reinicio');
  expect(requests.at(-1).messages).toHaveLength(2);
  await page.getByRole('button', { name: 'Todas las rutas', exact: true }).click();
  await enterCourse(page, { course: 'Python Práctica' });
  await expect(page.getByText('1 / 12 ejercicios', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tutor IA', exact: true }).click();
  await expect(page.getByText('Conversación de otro curso', { exact: true })).toBeVisible();
});

test('global reset includes courses retired from the catalog and their recovery copies, preserving downloaded catalog and settings', async ({ page, context }) => {
  const { setup } = await import('./fixtures/tutor.js');
  const { publication, serveCatalog } = await import('./fixtures/catalog.js');
  const requests = await setup(page, undefined, 'Respuesta completa');
  await approve(page);
  await ask(page, 'Curso que permanece');
  await page.getByRole('button', { name: 'Todas las rutas', exact: true }).click();
  await enterCourse(page, { course: 'Python Práctica' });
  await approve(page);
  await ask(page, 'Curso que se retira');
  await page.getByRole('button', { name: 'Todas las rutas', exact: true }).click();
  await page.evaluate(() => {
    const key = 'python-tutor:course-progress:v1:%5B%22original%22%2C%22python-practica%22%5D';
    const raw = JSON.parse(window.__learnerTest.getItem(key));
    raw.completed.push(null);
    window.__learnerTest.setItem(key, JSON.stringify(raw));
  });
  await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: /recuperación parcial/ })).toBeVisible();
  const retired = publication('retired-reset');
  retired.catalog.courses = retired.catalog.courses.filter(course => course.id !== 'python-practica');
  retired.catalog.learningPaths[0].courseIds = ['python-fundamentos'];
  await serveCatalog(context, retired);
  await page.reload();
  await page.getByRole('button', { name: 'Recargar para actualizar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Cursos y rutas de aprendizaje', exact: true })).toBeVisible();
  const kept = await page.evaluate(() => Object.fromEntries(window.__learnerTest.entries().filter(([key]) => key === 'python-tutor:catalog:v1' || (!key.includes('course-') && !key.includes('recovery:')))));
  await page.getByRole('button', { name: 'Reiniciar todo el aprendizaje', exact: true }).click();
  const confirmation = page.getByRole('group', { name: 'Confirmar reinicio' });
  await expect(confirmation).toContainText('retirados del catálogo');
  await confirmation.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await reset(page, true);
  await expect(page.getByRole('group', { name: 'Confirmar reinicio' })).not.toBeVisible();
  expect(await page.evaluate(() => window.__learnerTest.keys().filter(key => key.includes('course-progress:') || key.includes('course-conversations:') || key.includes('recovery:')))).toEqual([]);
  expect(await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, window.__learnerTest.getItem(key)])), Object.keys(kept))).toEqual(kept);
  await serveCatalog(context, publication('returned-reset'));
  await page.reload();
  await page.getByRole('button', { name: 'Recargar para actualizar', exact: true }).click();
  await enterCourse(page, { course: 'Python Práctica' });
  await expect(page.getByText('0 / 12 ejercicios', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tutor IA', exact: true }).click();
  await expect(page.getByText('Curso que se retira', { exact: true })).toHaveCount(0);
  expect(requests).toHaveLength(2);
});

for (const global of [false, true]) {
  test(`${global ? 'global' : 'course'} explicit reset overwrites protected originals when deletion and recovery-copy writes are blocked`, async ({ page }) => {
    const { setup } = await import('./fixtures/tutor.js');
    await setup(page, undefined, 'Respuesta completa');
    await approve(page);
    await ask(page, 'Original protegido');
    await page.getByRole('button', { name: 'Todas las rutas', exact: true }).click();
    await page.evaluate(() => {
      for (const key of window.__learnerTest.keys().filter(key => key.startsWith('python-tutor:course-'))) {
        const raw = JSON.parse(window.__learnerTest.getItem(key));
        if (Array.isArray(raw)) raw.push(null);
        else raw.completed.push(null);
        window.__learnerTest.setItem(key, JSON.stringify(raw));
      }
    });
    await page.addInitScript(() => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key === 'python-tutor:learner-store:v1' && Object.keys(JSON.parse(value).records).some((record) => record.startsWith('python-tutor:recovery:'))) throw new DOMException('Blocked', 'QuotaExceededError');
        return set.call(this, key, value);
      };
      Storage.prototype.removeItem = function() { throw new DOMException('Blocked', 'SecurityError'); };
    });
    await page.reload();
    await expect(page.getByRole('alert').filter({ hasText: /sin sobrescribir/i }).first()).toBeVisible();
    await enterCourse(page);
    await reset(page, global);
    await expect(page.getByRole('group', { name: 'Confirmar reinicio' })).not.toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: /podría reaparecer|no se pudo borrar/i })).toHaveCount(0);
    await page.reload();
    await enterCourse(page);
    await expect(page.getByText('0 / 12 ejercicios', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Tutor IA', exact: true }).click();
    await expect(page.getByText('Original protegido', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('alert').filter({ hasText: /recuperación parcial/i })).toHaveCount(0);
  });
}

test('global reset warns when the browser prevents enumerating retired course data', async ({ page }) => {
  await page.goto('/');
  await enterCourse(page);
  await approve(page);
  await page.evaluate(() => {
    const storage = localStorage;
    Object.defineProperty(window, 'localStorage', { configurable: true, value: new Proxy(storage, {
      ownKeys() { throw new DOMException('Blocked', 'SecurityError'); },
      get(target, property) {
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) });
  });
  await reset(page, true);
  await expect(page.getByRole('alert').filter({ hasText: /No se pudo guardar el reinicio/ })).toBeVisible();
  await page.reload();
  await enterCourse(page);
  await expect(page.getByText('1 / 12 ejercicios', { exact: true })).toBeVisible();
});

test('an approved exercise retired before course reset returns pending when republished', async ({ page, context }) => {
  const { publication, updateCourse, serveCatalog } = await import('./fixtures/catalog.js');
  await page.goto('/');
  await enterCourse(page);
  await approve(page);
  await page.getByRole('button', { name: 'Todas las rutas', exact: true }).click();
  const retired = publication('exercise-retired-reset');
  updateCourse(retired, 'python-fundamentos', course => { course.topics[0].exercises.shift(); });
  await serveCatalog(context, retired);
  await page.reload();
  await page.getByRole('button', { name: 'Recargar para actualizar', exact: true }).click();
  await enterCourse(page);
  await expect(page.getByText('0 / 11 ejercicios', { exact: true })).toBeVisible();
  await reset(page);
  await expect(page.getByRole('group', { name: 'Confirmar reinicio' })).not.toBeVisible();
  await serveCatalog(context, publication('exercise-returned-reset'));
  await page.reload();
  await page.getByRole('button', { name: 'Recargar para actualizar', exact: true }).click();
  await enterCourse(page);
  await expect(page.getByText('0 / 12 ejercicios', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /Ejercicios/ }).click();
  await expect(page.getByRole('button', { name: /1\. Tu primera variable/ })).not.toContainText('Completado');
});

test('reset reports surviving recovery copies when both safe clearing operations fail', async ({ page }) => {
  await page.goto('/');
  await enterCourse(page);
  await approve(page);
  await page.getByRole('button', { name: 'Todas las rutas', exact: true }).click();
  await page.evaluate(() => {
    const key = 'python-tutor:course-progress:v1:%5B%22original%22%2C%22python-fundamentos%22%5D';
    const saved = JSON.parse(window.__learnerTest.getItem(key));
    saved.completed.push(null);
    window.__learnerTest.setItem(key, JSON.stringify(saved));
  });
  await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: /recuperación parcial/i })).toBeVisible();
  await enterCourse(page);
  await page.evaluate(() => {
    for (const method of ['setItem', 'removeItem']) {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function(key, ...args) {
        if (key === 'python-tutor:learner-store:v1') throw new DOMException('Blocked', 'SecurityError');
        return original.call(this, key, ...args);
      };
    }
  });
  await reset(page);
  await expect(page.getByRole('alert').filter({ hasText: /No se pudo guardar el reinicio/ })).toBeVisible();
  await expect(page.getByText('1 / 12 ejercicios', { exact: true })).toBeVisible();
});

test('global learning reset preserves a damaged practice recovery copy', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('python-tutor:practice:v2', '{damaged practice'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Práctica', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('registro está dañado');
  const copies = await page.evaluate(() => window.__learnerTest.entries().filter(([, value]) => value === '{damaged practice').map(([key]) => key));
  expect(copies.length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Cursos y rutas', exact: true }).click();
  await enterCourse(page);
  await reset(page, true);
  expect(await page.evaluate(keys => keys.map(key => window.__learnerTest.getItem(key)), copies)).toContain('{damaged practice');
});
