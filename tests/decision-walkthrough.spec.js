import { test, expect, enterCourse, publication, serveCatalog, updateCourse } from './fixtures/catalog.js';
import { setup, model } from './fixtures/tutor.js';
import collection from './fixtures/collection.json' with { type: 'json' };

const walkthrough = { type: 'decision', elements: [{id:'condition',label:'temperatura >= 24'}, {id:'if',label:'if'}, {id:'else',label:'else'}], scenarios: [{id:'25',label:'25', replacement:{line:1,code:'temperatura = 25'}, steps:[{line:2,element:'condition',explanation:'La condición es verdadera.'},{line:3,element:'if',explanation:'Se muestra calor.',output:'Hace calor'}]}, {id:'24',label:'24', replacement:{line:1,code:'temperatura = 24'}, steps:[{line:2,element:'condition',explanation:'La condición es verdadera.'},{line:3,element:'if',explanation:'Se muestra calor.',output:'Hace calor'}]}, {id:'23',label:'23', replacement:{line:1,code:'temperatura = 23'}, steps:[{line:2,element:'condition',explanation:'La condición es falsa.'},{line:5,element:'else',explanation:'Se muestra fresco.',output:'Hace fresco'}]}] };

test('questions capture the visible decision as the learner changes it', async ({ page, context }) => {
 const catalog = publication('decision-tutor');
 updateCourse(catalog, 'python-fundamentos', course => { course.topics[0].example = 'temperatura = 25\nif temperatura >= 24:\n    print("Hace calor")\nelse:\n    print("Hace fresco")'; course.topics[0].walkthrough = walkthrough; });
 await serveCatalog(context, catalog);
 const requests = await setup(page);
 await page.getByRole('button', { name: 'Cerrar Tutor' }).click();
 await page.getByRole('tab', { name: 'Lección' }).click();
 async function ask(message) {
   const count = requests.length + 1;
   await page.getByRole('button', { name: 'Tutor IA' }).click();
   await page.getByLabel('Mensaje al tutor').fill(message);
   await page.getByRole('button', { name: 'Enviar', exact: true }).click();
   await expect(page.getByText('Respuesta completa', { exact: true })).toHaveCount(count);
   await page.getByRole('button', { name: 'Cerrar Tutor' }).click();
   return JSON.parse(requests.at(-1).messages.at(-1).content).capture;
 }
 const initial = await ask('¿Qué ocurre?');
 expect(initial.walkthrough).toMatchObject({ type: 'decision', scenario: { id: '25', label: '25' }, step: { line: 2, element: 'condition', explanation: 'La condición es verdadera.' }, output: '' });
 await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
 const advanced = await ask('¿Y ahora?');
 expect(advanced.walkthrough).toMatchObject({ step: { line: 3, element: 'if' }, output: 'Hace calor' });
 await page.getByRole('button', { name: '23', exact: true }).click();
 await page.getByRole('button', { name: 'else', exact: true }).click();
 const jumped = await ask('¿Y con 23?');
 expect(jumped.walkthrough).toMatchObject({ scenario: { id: '23', label: '23' }, step: { line: 5, element: 'else', explanation: 'Se muestra fresco.' }, output: 'Hace fresco', code: expect.stringContaining('temperatura = 23') });
});

test('retry after changing the step and reloading preserves the original capture', async ({ page, context }) => {
 const catalog = publication('decision-retry');
 updateCourse(catalog, 'python-fundamentos', course => { course.topics[0].example = 'temperatura = 25\nif temperatura >= 24:\n    print("Hace calor")\nelse:\n    print("Hace fresco")'; course.topics[0].walkthrough = walkthrough; });
 await serveCatalog(context, catalog);
 const requests = await setup(page, model, 'Pista', 'length');
 await page.getByRole('button', { name: 'Cerrar Tutor' }).click();
 await page.getByRole('tab', { name: 'Lección' }).click();
 await page.getByRole('button', { name: '23', exact: true }).click();
 await page.getByRole('button', { name: 'else', exact: true }).click();
 await page.getByRole('button', { name: 'Tutor IA' }).click();
 await page.getByLabel('Mensaje al tutor').fill('Explícame');
 await page.getByRole('button', { name: 'Enviar', exact: true }).click();
 await expect(page.getByRole('button', { name: 'Reintentar respuesta' })).toBeEnabled();
 const original = JSON.parse(requests[0].messages.at(-1).content).capture;
 await page.getByRole('button', { name: 'Cerrar Tutor' }).click();
 await page.getByRole('button', { name: '25', exact: true }).click();
 await page.reload();
 await enterCourse(page);
 await page.getByRole('button', { name: 'Tutor IA' }).click();
 await page.getByRole('button', { name: 'Reintentar respuesta' }).click();
 await expect.poll(() => requests.length).toBe(2);
 expect(JSON.parse(requests[1].messages.at(-1).content).capture).toEqual(original);
});

for (const [name, value, example, selected, expected] of [
 ['sequence', { type: 'sequence', elements: [{ id: 'one', label: 'Uno' }, { id: 'two', label: 'Dos' }], steps: [{ element: 'one', line: 1, explanation: 'Primero.' }, { element: 'two', line: 2, explanation: 'Segundo.', output: 'Dos' }] }, 'print("Uno")\nprint("Dos")', 'Dos', { type: 'sequence', element: { id: 'two', label: 'Dos' }, output: 'Dos' }],
 ['collection', collection, 'colores = ["rojo", "azul"]\ncolores.append("verde")\nprint(colores[0])\n\nlibro = {"titulo": "Python", "paginas": 100}\nprint(libro["titulo"])', 'titulo: Python', { type: 'collection', element: { id: 'titulo', key: 'titulo', value: 'Python' }, output: 'rojo\nPython' }],
]) test(`${name} sends the selected visible state`, async ({ page, context }) => {
 const catalog = publication(`tutor-${name}`);
 updateCourse(catalog, 'python-fundamentos', course => { course.topics[0].example = example; course.topics[0].walkthrough = value; });
 await serveCatalog(context, catalog);
 const requests = await setup(page);
 await page.getByRole('button', { name: 'Cerrar Tutor' }).click();
 await page.getByRole('tab', { name: 'Lección' }).click();
 await page.getByRole('button', { name: selected, exact: true }).click();
 await page.getByRole('button', { name: 'Tutor IA' }).click();
 await page.getByLabel('Mensaje al tutor').fill('Explica');
 await page.getByRole('button', { name: 'Enviar', exact: true }).click();
 await expect(page.getByText('Respuesta completa', { exact: true })).toBeVisible();
 expect(JSON.parse(requests[0].messages.at(-1).content).capture.walkthrough).toMatchObject(expected);
});

test('a learner follows a decision and returns to the same step', async ({page,context}) => {
 const catalog=publication('decision');
 updateCourse(catalog,'python-fundamentos',course=>{course.topics[0].example='temperatura = 25\nif temperatura >= 24:\n    print("Hace calor")\nelse:\n    print("Hace fresco")'; course.topics[0].walkthrough=walkthrough;});
 await serveCatalog(context,catalog); await page.goto('/'); await enterCourse(page);
 await expect(page.getByRole('heading',{name:'Decisión'})).toBeVisible();
 await page.getByRole('button',{name:'Siguiente',exact:true}).click();
 await expect(page.getByLabel('Salida del recorrido')).toHaveText('Hace calor');
 await page.getByRole('button',{name:'24',exact:true}).click();
 await page.getByRole('button',{name:'if',exact:true}).click();
 await expect(page.getByLabel('Salida del recorrido')).toHaveText('Hace calor');
 await page.getByRole('button',{name:'23',exact:true}).click();
 await page.getByRole('button',{name:'else',exact:true}).click();
 await expect(page.getByLabel('Salida del recorrido')).toHaveText('Hace fresco');
 await page.getByRole('button',{name:/02 Expresiones y salida/}).click();
 await page.getByRole('button',{name:/01 Valores y variables/}).click();
 await expect(page.getByLabel('Salida del recorrido')).toHaveText('Hace fresco');
});

for (const [name, mutate] of [
 ['unknown template', w => { w.type = 'unknown'; }],
 ['duplicate element', w => { w.elements[1].id = 'condition'; }],
 ['unknown element', w => { w.scenarios[0].steps[0].element = 'missing'; }],
 ['invalid line', w => { w.scenarios[0].steps[0].line = 100; }],
]) test(`invalid ${name} preserves the saved publication`, async ({page,context}) => {
 await page.goto('/');
 await expect(page.getByRole('button',{name:'Explorar Primeros pasos con Python'})).toBeVisible();
 const old = await page.evaluate(() => localStorage.getItem('python-tutor:catalog:v1'));
 const next=publication('invalid-decision');
 updateCourse(next,'python-fundamentos',course=>{course.topics[0].walkthrough=structuredClone(walkthrough); mutate(course.topics[0].walkthrough);});
 await serveCatalog(context,next); await page.reload();
 await expect(page.getByRole('alert')).toContainText('No se pudo actualizar el catálogo');
 expect(await page.evaluate(() => localStorage.getItem('python-tutor:catalog:v1'))).toBe(old);
});

test('mobile stacks the decision diagram and code', async ({page,context}) => {
 await page.setViewportSize({width:390,height:844});
 const catalog=publication('mobile-decision');
 updateCourse(catalog,'python-fundamentos',course=>{course.topics[0].walkthrough=walkthrough;});
 await serveCatalog(context,catalog); await page.goto('/'); await enterCourse(page);
 const diagram=await page.getByRole('button',{name:'if',exact:true}).boundingBox();
 const code=await page.getByLabel('Código del recorrido').boundingBox();
 expect(code.y).toBeGreaterThan(diagram.y + diagram.height);
 await page.getByRole('button',{name:'Siguiente',exact:true}).click();
 await expect(page.getByLabel('Salida del recorrido')).toHaveText('Hace calor');
});
