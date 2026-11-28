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

test('linked SVG walkthrough renders its code from the saved publication', async ({page, context}) => {
  const catalog = publication('lesson-svg');
  updateCourse(catalog, 'python-fundamentos', course => {
    const topic = course.topics[0];
    delete topic.explanation; delete topic.example; delete topic.takeaway;
    const code = 'x = 25\nprint(x)';
    const walkthrough = {type:'svg', code:true, graphics:{scene:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" data-part="box"/></svg>'}, scenarios:[{id:'a',label:'A',graphic:'scene',steps:[{line:2,explanation:'Muestra x',output:'25'}]}]};
    topic.lessons = [{id:'one',title:'Ejemplo',markdown:'# Ejemplo\n\n```python\nx = 25\nprint(x)\n```\n\n[Recorrido](../walkthroughs/example.json)',walkthroughs:[{code,walkthrough}]}];
  });
  await context.unrouteAll({behavior:'wait'}); await serveCatalog(context,catalog);
  await page.goto('/'); await enterCourse(page);
  await expect(page.getByLabel('Código del recorrido')).toContainText('print(x)');
  await expect(page.getByText('Muestra x')).toBeVisible();
  await expect(page.getByRole('link',{name:'Recorrido'})).toHaveCount(0);
  await context.unrouteAll({behavior:'wait'}); await context.route('https://www.ider.ninja/python-tutor-content/**', route => route.abort());
  await page.reload(); await enterCourse(page);
  await expect(page.getByLabel('Código del recorrido')).toContainText('print(x)');
});
