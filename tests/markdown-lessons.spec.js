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
    topic.lessons = [{id:'one',title:'Ejemplo',markdown:'# Ejemplo\n\n```python\nx = 25\nprint(x)\n```\n\n[Recorrido][demo]\n\n[demo]: ../walkthroughs/example.json',walkthroughs:[{code,walkthrough}]}];
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

test('an invalid linked scene leaves the previous publication available', async ({page, context}) => {
  await context.unrouteAll({behavior:'wait'}); await serveCatalog(context,publication('valid-before-svg'));
  await page.goto('/'); await enterCourse(page);
  const invalid=publication('invalid-svg');
  updateCourse(invalid,'python-fundamentos',course=>{
    const topic=course.topics[0]; delete topic.explanation;delete topic.example;delete topic.takeaway;
    topic.lessons=[{id:'one',title:'Ejemplo',markdown:'# Ejemplo\n\n```python\nprint(1)\n```\n\n[Recorrido](../walkthroughs/example.json)',walkthroughs:[{code:'print(1)',walkthrough:{type:'svg',code:true,graphics:{scene:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script></svg>'},scenarios:[{id:'a',label:'A',graphic:'scene',steps:[{line:1,explanation:'Muestra'}]}]}}]}];
  });
  await context.unrouteAll({behavior:'wait'});await serveCatalog(context,invalid);await page.reload();await enterCourse(page);
  await expect(page.getByText('Una variable es un nombre que guarda un valor.')).toBeVisible();
});

test('mixed examples and repeated walkthroughs preserve order and independent state', async ({page, context}) => {
  const catalog = publication('multiple-lesson-walkthroughs');
  updateCourse(catalog, 'python-fundamentos', course => {
    const topic = course.topics[0]; delete topic.explanation; delete topic.example; delete topic.takeaway;
    const graphics={scene:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" data-part="box"/></svg>'};
    const walkthrough={type:'svg',code:true,graphics,scenarios:[{id:'a',label:'A',graphic:'scene',steps:[{line:1,explanation:'Primer paso'},{line:2,explanation:'Segundo paso'}]},{id:'b',label:'B',graphic:'scene',steps:[{line:1,explanation:'Otro escenario'},{line:2,explanation:'Final'}]}]};
    const visual={type:'svg',graphics,scenarios:[{id:'a',label:'A',graphic:'scene',steps:[{explanation:'Solo visual'}]}]};
    const code='x = 2\nprint(x)';
    topic.lessons=[{id:'one',title:'Mezcla',markdown:'# Mezcla\n\n```python\nprint("estático")\n```\n\n[Visual](visual.json)\n\n```python\nx = 2\nprint(x)\n```\n\n[Uno](demo.json)\n\n```python\nx = 2\nprint(x)\n```\n\n[Dos](demo.json)',walkthroughs:[{code:null,walkthrough:visual},{code,walkthrough},{code,walkthrough}]}];
  });
  await serveCatalog(context,catalog); await page.goto('/'); await enterCourse(page);
  const players=page.getByRole('region',{name:'Recorrido interactivo'});
  await expect(players).toHaveCount(3);
  await expect(page.locator('pre').filter({hasText:'estático'})).toBeVisible();
  await expect(players.nth(0).getByText('Solo visual')).toBeVisible();
  expect(await page.locator('pre').filter({hasText:'estático'}).evaluate((node) => Boolean(node.compareDocumentPosition(document.querySelector('[aria-label="Recorrido interactivo"]')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await expect(players.nth(1).getByLabel('Código del recorrido')).toContainText('x = 2');
  await expect(players.nth(2).getByLabel('Código del recorrido')).toContainText('x = 2');
  await players.nth(1).getByRole('button',{name:'B',exact:true}).click();
  await players.nth(1).getByRole('button',{name:'Siguiente',exact:true}).click();
  await expect(players.nth(1).getByLabel('Paso del recorrido')).toHaveText('2 / 2');
  await expect(players.nth(2).getByLabel('Paso del recorrido')).toHaveText('1 / 2');
  await expect(players.nth(2).getByRole('button',{name:'A',exact:true})).toHaveAttribute('aria-pressed','true');
});
