import { test, expect, enterCourse, publication, serveCatalog, updateCourse } from './fixtures/catalog.js';

test('learners choose ordered lessons and restore their visit with browser history', async ({ page, context }) => {
  const catalog = publication('markdown-lessons');
  updateCourse(catalog, 'python-fundamentos', course => {
    const topic = course.topics[0];
    delete topic.explanation; delete topic.example; delete topic.takeaway;
    topic.lessons = [
      { id:'one', title:'Primera explicación completa', markdown:'# Primera explicación completa\n\n**Texto inicial**.' },
      { id:'two', title:'Segunda explicación completa', markdown:'# Segunda explicación completa\n\n> [!TIP]\n> Usa **Python**.' },
      { id:'three', title:'Tercera explicación completa', markdown:'# Tercera explicación completa\n\n```python\nprint(3)\n```' },
    ];
  });
  await serveCatalog(context, catalog);
  await page.goto('/'); await enterCourse(page);
  await expect(page.getByText('Texto inicial')).toBeVisible();
  await page.getByRole('button', {name:'Segunda explicación completa'}).click();
  await expect(page.getByText('Consejo Usa Python.', {exact:true})).toBeVisible();
  await page.getByRole('tab', {name:/Ejercicios/}).click();
  await page.getByRole('tab', {name:'Lección'}).click();
  await expect(page.getByText('Consejo Usa Python.', {exact:true})).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('tab', {name:/Ejercicios/})).toHaveAttribute('aria-selected', 'true');
  await page.goBack();
  await expect(page.getByText('Consejo Usa Python.', {exact:true})).toBeVisible();
  await page.goBack();
  await expect(page.getByText('Texto inicial')).toBeVisible();
});

test('invalid updated lessons preserve the last valid backup', async ({ page, context }) => {
  const old = publication('before-lessons');
  await serveCatalog(context, old);
  await page.goto('/'); await enterCourse(page);
  await expect(page.getByText('Una variable es un nombre que guarda un valor.')).toBeVisible();
  const invalid = publication('invalid-lessons');
  updateCourse(invalid, 'python-fundamentos', course => {
    const topic = course.topics[0];
    delete topic.explanation; delete topic.example; delete topic.takeaway;
    topic.lessons = [{ id:'same', title:'Una', markdown:'# Una' }, { id:'same', title:'Otra', markdown:'# Otra' }];
  });
  await context.unrouteAll({ behavior:'wait' });
  await serveCatalog(context, invalid);
  await page.reload();
  await enterCourse(page);
  await expect(page.getByText('Una variable es un nombre que guarda un valor.')).toBeVisible();
});

test('a mixed update activates on reload and its saved Markdown works offline', async ({ page, context }) => {
  await serveCatalog(context, publication('historical'));
  await page.goto('/'); await enterCourse(page);
  const updated = publication('mixed');
  updateCourse(updated, 'python-fundamentos', course => {
    const topic = course.topics[0];
    delete topic.explanation; delete topic.example; delete topic.takeaway;
    topic.lessons = [{ id:'welcome', title:'Bienvenida Markdown', markdown:'# Bienvenida Markdown\n\nContenido guardado.' }];
  });
  await context.unrouteAll({ behavior:'wait' }); await serveCatalog(context, updated);
  await page.reload();
  await expect(page.getByText(/Hay contenido nuevo/i)).toBeVisible();
  await page.reload(); await enterCourse(page);
  await expect(page.getByText('Contenido guardado.')).toBeVisible();
  await context.unrouteAll({ behavior:'wait' });
  await context.route('https://www.ider.ninja/python-tutor-content/**', route => route.abort());
  await page.reload(); await enterCourse(page);
  await expect(page.getByText('Contenido guardado.')).toBeVisible();
});
