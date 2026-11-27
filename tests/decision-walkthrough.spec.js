import { test, expect, enterCourse, publication, serveCatalog, updateCourse } from './fixtures/catalog.js';

const walkthrough = { type: 'decision', elements: [{id:'condition',label:'temperatura >= 24'}, {id:'if',label:'if'}, {id:'else',label:'else'}], scenarios: [{id:'25',label:'25', replacement:{line:1,code:'temperatura = 25'}, steps:[{line:2,element:'condition',explanation:'La condición es verdadera.'},{line:3,element:'if',explanation:'Se muestra calor.',output:'Hace calor'}]}, {id:'24',label:'24', replacement:{line:1,code:'temperatura = 24'}, steps:[{line:2,element:'condition',explanation:'La condición es verdadera.'},{line:3,element:'if',explanation:'Se muestra calor.',output:'Hace calor'}]}, {id:'23',label:'23', replacement:{line:1,code:'temperatura = 23'}, steps:[{line:2,element:'condition',explanation:'La condición es falsa.'},{line:5,element:'else',explanation:'Se muestra fresco.',output:'Hace fresco'}]}] };

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
