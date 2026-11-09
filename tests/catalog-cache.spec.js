import { test, expect, publication, serveCatalog, updateCourse } from './fixtures/catalog.js';

const paths = (page) => page.getByRole('button', { name: 'Explorar Primeros pasos con Python', exact: true });

test('saved complete publication opens immediately while a new revision downloads and activates only after reload', async ({page, context}) => {
  await page.goto('/');
  await expect(paths(page)).toBeVisible();
  const next = publication('fixture-2');
  next.catalog.learningPaths[0].title = 'Ruta nueva';
  updateCourse(next, 'python-fundamentos', course => { course.title = 'Fundamentos nuevos'; });
  await serveCatalog(context, next);
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await context.route('**/courses/python-practica.fixture-2.json', async route => {
    await held;
    await route.fulfill({body: next.files['courses/python-practica.fixture-2.json'], contentType:'application/json'});
  });
  await page.reload();
  await expect(paths(page)).toBeVisible();
  await expect(page.getByRole('button', { name:'Explorar Ruta nueva', exact:true })).toHaveCount(0);
  release();
  await expect(page.getByText('Hay contenido nuevo. Recargar para actualizar', {exact:true})).toBeVisible();
  await paths(page).click();
  await expect(page.getByRole('heading', {name:'Python Fundamentos', exact:true})).toBeVisible();
  await expect(page.getByRole('heading', {name:'Fundamentos nuevos', exact:true})).toHaveCount(0);
  let releaseCatalog;
  const catalogHeld = new Promise(resolve => { releaseCatalog = resolve; });
  await context.route('**/catalog.json', async route => {
    await catalogHeld;
    await route.fulfill({json:next.catalog});
  });
  await page.getByRole('button', {name:'Recargar para actualizar', exact:true}).click();
  await expect(page.getByRole('button', {name:'Explorar Ruta nueva', exact:true})).toBeVisible();
  await page.getByRole('button', {name:'Explorar Ruta nueva', exact:true}).click();
  releaseCatalog();
  await expect(page.getByRole('heading', {name:'Fundamentos nuevos', exact:true})).toBeVisible();
});

const temporary = 'Este contenido no pudo guardarse; al recargar necesitarás volver a descargarlo';
async function blockBackupWrites(context) {
  await context.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'python-tutor:catalog:v1') throw new DOMException('Full', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
}

test('first valid download remains usable with an honest temporary warning when storage is blocked', async ({page, context}) => {
  await blockBackupWrites(context);
  await page.goto('/');
  await expect(paths(page)).toBeVisible();
  await expect(page.getByText(temporary, {exact:true})).toBeVisible();
  await expect(page.getByRole('button', {name:'Reintentar', exact:true})).toBeVisible();
  await context.route('**/catalog.json', route => route.abort());
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('No se pudo cargar el catálogo');
  await expect(paths(page)).toHaveCount(0);
});

test('unsaved new revision stays frozen, activates temporarily with Reload, and preserves the old backup', async ({page, context}) => {
  await page.goto('/');
  await expect(paths(page)).toBeVisible();
  await blockBackupWrites(context);
  const next = publication('fixture-2');
  next.catalog.learningPaths[0].title = 'Ruta nueva';
  await serveCatalog(context, next);
  await page.reload();
  await expect(page.getByText('Hay contenido nuevo. Recargar para actualizar', {exact:true})).toBeVisible();
  await expect(page.getByText(temporary, {exact:true})).toBeVisible();
  await expect(paths(page)).toBeVisible();
  await page.getByRole('button', {name:'Recargar para actualizar', exact:true}).click();
  await expect(page.getByRole('button', {name:'Explorar Ruta nueva', exact:true})).toBeVisible();
  await expect(page.getByText(temporary, {exact:true})).toBeVisible();
  await context.route('**/catalog.json', route => route.abort());
  await page.reload();
  await expect(paths(page)).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('No se pudo actualizar el catálogo');
});

for (const [name, change, reason] of [
  ['hash mismatch', value => { value.files[value.catalog.courses[1].file] += ' '; }, 'SHA-256'],
  ['invalid course', value => updateCourse(value, 'python-practica', course => { course.topics = []; }), 'topics'],
  ['unknown format', value => { value.catalog.schemaVersion = 2; }, 'schemaVersion'],
  ['missing course', value => { delete value.files[value.catalog.courses[1].file]; }, 'HTTP 404'],
  ['changed same revision', value => { value.catalog.revision = 'fixture-1'; }, 'misma revisión'],
  ['mutated immutable file', value => {
    const record = value.catalog.courses[0];
    value.files['courses/python-fundamentos.fixture-1.json'] = value.files[record.file];
    record.file = 'courses/python-fundamentos.fixture-1.json';
    updateCourse(value, 'python-fundamentos', course => { course.title = 'Archivo cambiado'; });
  }, 'inmutable'],
]) test(`rejects ${name} without replacing the complete backup and retry recovers`, async ({page, context}) => {
  await page.goto('/');
  await expect(paths(page)).toBeVisible();
  const next = publication('fixture-2');
  next.catalog.learningPaths[0].title = 'Ruta nueva';
  change(next);
  await serveCatalog(context, next);
  await page.reload();
  await expect(paths(page)).toBeVisible();
  await expect(page.getByRole('alert')).toContainText(reason);
  await expect(page.getByText('Hay contenido nuevo. Recargar para actualizar', {exact:true})).toHaveCount(0);
  await context.route('**/catalog.json', route => route.abort());
  await page.reload();
  await expect(paths(page)).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('No se pudo actualizar el catálogo');
  await context.unroute('**/catalog.json');
  const fixed = publication('fixture-3');
  fixed.catalog.learningPaths[0].title = 'Ruta reparada';
  await serveCatalog(context, fixed);
  await page.getByRole('button', {name:'Reintentar', exact:true}).click();
  await expect(page.getByText('Hay contenido nuevo. Recargar para actualizar', {exact:true})).toBeVisible();
  await expect(paths(page)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', {name:'Explorar Ruta reparada', exact:true})).toBeVisible();
});

test('backup retains original whitespace and Unicode bytes and an unchanged revision needs no activation', async ({page, context}) => {
  const value = publication();
  updateCourse(value, 'python-fundamentos', course => { course.description = '¡Aprende Python! 🐍'; });
  const record = value.catalog.courses[0];
  value.files[record.file] = JSON.stringify(JSON.parse(value.files[record.file]), null, 2) + '\n';
  const { createHash } = await import('node:crypto');
  record.sha256 = createHash('sha256').update(value.files[record.file]).digest('hex');
  await serveCatalog(context, value);
  await page.goto('/');
  await expect(paths(page)).toBeVisible();
  await page.reload();
  await paths(page).click();
  await expect(page.getByText('¡Aprende Python! 🐍', {exact:true})).toBeVisible();
  await expect(page.getByText('Hay contenido nuevo. Recargar para actualizar', {exact:true})).toHaveCount(0);
  await context.route('**/catalog.json', route => route.abort());
  await page.reload();
  await paths(page).click();
  await expect(page.getByText('¡Aprende Python! 🐍', {exact:true})).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('No se pudo actualizar el catálogo');
});

for (const corruption of ['changed source', 'missing source', 'malformed catalog'])
  test(`does not activate a damaged backup: ${corruption}`, async ({page, context}) => {
    await page.goto('/');
    await expect(paths(page)).toBeVisible();
    await page.evaluate(corruption => {
      const key = 'python-tutor:catalog:v1';
      const backup = JSON.parse(localStorage.getItem(key));
      if (corruption === 'changed source') {
        const source = JSON.parse(backup.courseFiles['python-fundamentos']);
        source.title = 'Contenido no verificado';
        backup.courseFiles['python-fundamentos'] = JSON.stringify(source);
      } else if (corruption === 'missing source') delete backup.courseFiles['python-practica'];
      else backup.catalog.schemaVersion = 100;
      localStorage.setItem(key, JSON.stringify(backup));
    }, corruption);
    await context.route('**/catalog.json', route => route.abort());
    await page.reload();
    await expect(page.getByRole('alert')).toContainText('No se pudo cargar el catálogo');
    await expect(paths(page)).toHaveCount(0);
    await context.unroute('**/catalog.json');
    await page.getByRole('button', {name:'Reintentar', exact:true}).click();
    await expect(paths(page)).toBeVisible();
  });
