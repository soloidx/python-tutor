import { test, expect, enterCourse, sourceBase } from './fixtures/catalog.js';
import { mkdtemp, cp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

// Run with CONTENT_REPO=/path/to/python-tutor-content after npm ci in both repos.
test('publisher-generated mixed lesson survives download and offline restore', async ({page, context}) => {
  test.skip(!process.env.CONTENT_REPO, 'Set CONTENT_REPO to an installed publisher checkout');
  const publisher = resolve(process.env.CONTENT_REPO);
  const root = await mkdtemp(join(tmpdir(), 'publisher-integration-'));
  try {
    await cp(join(publisher, 'content'), join(root, 'content'), {recursive:true});
    await cp(join(publisher, 'scripts'), join(root, 'scripts'), {recursive:true});
    await cp(join(publisher, 'package.json'), join(root, 'package.json'));
    await symlink(join(publisher, 'node_modules'), join(root, 'node_modules'), 'dir');
    const courseFile = join(root, 'content/courses/python-fundamentos.json');
    const course = JSON.parse(await readFile(courseFile, 'utf8'));
    const topic = course.topics[0];
    delete topic.explanation; delete topic.example; delete topic.takeaway; delete topic.walkthrough;
    topic.lessons = [{id:'mixed', file:'lessons/integration-mixed.md'}];
    await writeFile(courseFile, JSON.stringify(course));
    await mkdir(join(root, 'content/lessons'), {recursive:true});
    await mkdir(join(root, 'content/walkthroughs/graphics'), {recursive:true});
    await writeFile(join(root, 'content/walkthroughs/graphics/integration.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" data-part="box"/></svg>');
    const graphics={scene:'walkthroughs/graphics/integration.svg'};
    const visual={type:'svg',graphics,scenarios:[{id:'a',label:'A',graphic:'scene',steps:[{explanation:'Escena visual'}]}]};
    const code={type:'svg',code:true,graphics,scenarios:[{id:'a',label:'A',graphic:'scene',steps:[{line:1,explanation:'Inicio'},{line:2,explanation:'Final'}]}]};
    await writeFile(join(root, 'content/walkthroughs/integration-visual.json'), JSON.stringify(visual));
    await writeFile(join(root, 'content/walkthroughs/integration-code.json'), JSON.stringify(code));
    await writeFile(join(root, 'content/lessons/integration-mixed.md'), '# Lección integrada\n\n```python\nprint("estático")\n```\n\n[Visual](../walkthroughs/integration-visual.json)\n\n```python\nx = 2\nprint(x)\n```\n\n[Uno](../walkthroughs/integration-code.json)\n\n```python\nx = 3\nprint(x)\n```\n\n[Dos](../walkthroughs/integration-code.json)\n');
    execFileSync(process.execPath, ['scripts/build.mjs'], {cwd:root, stdio:'pipe'});
    execFileSync(process.execPath, ['scripts/check.mjs'], {cwd:root, stdio:'pipe'});
    await context.unrouteAll({behavior:'wait'});
    await context.route(`${sourceBase}**`, async route => {
      const file = route.request().url().slice(sourceBase.length);
      try { await route.fulfill({body:await readFile(join(root, 'public', file))}); }
      catch { await route.fulfill({status:404}); }
    });
    await page.goto('/'); await enterCourse(page);
    const players=page.getByRole('region',{name:'Recorrido interactivo'});
    await expect(players).toHaveCount(3);
    await expect(page.locator('pre').filter({hasText:'estático'})).toBeVisible();
    await expect(players.nth(0).getByText('Escena visual')).toBeVisible();
    await expect(players.nth(1).getByLabel('Código del recorrido')).toContainText('x = 2');
    await expect(players.nth(2).getByLabel('Código del recorrido')).toContainText('x = 3');
    await players.nth(1).getByRole('button',{name:'Siguiente',exact:true}).click();
    await expect(players.nth(1).getByLabel('Paso del recorrido')).toHaveText('2 / 2');
    await expect(players.nth(2).getByLabel('Paso del recorrido')).toHaveText('1 / 2');
    await context.unrouteAll({behavior:'wait'});
    await context.route(`${sourceBase}**`, route => route.abort());
    await page.reload(); await enterCourse(page);
    await expect(page.getByRole('region',{name:'Recorrido interactivo'})).toHaveCount(3);
    await expect(page.getByLabel('Código del recorrido').nth(1)).toContainText('x = 3');
  } finally { await rm(root, {recursive:true,force:true}); }
});
