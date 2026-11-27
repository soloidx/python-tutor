import { test, expect, enterCourse, publication, serveCatalog, updateCourse } from './fixtures/catalog.js';

const sequence = { type:'sequence', elements:[{id:'inicio',label:'Inicio'},{id:'uno',label:'Vuelta 1'},{id:'dos',label:'Vuelta 2'},{id:'tres',label:'Vuelta 3'},{id:'fin',label:'Final'}], steps:[{element:'inicio',line:1,explanation:'Comienza el bucle.'},{element:'uno',line:2,explanation:'Primera vuelta.',output:'Paso 1'},{element:'dos',line:2,explanation:'Segunda vuelta.',output:'Paso 2'},{element:'tres',line:2,explanation:'Tercera vuelta.',output:'Paso 3'},{element:'fin',line:3,explanation:'Termina el programa.',output:'Listo'}] };
for (const width of [390, 1280]) test(`sequence follows ordered output at ${width}px`, async ({page,context}) => {
 await page.setViewportSize({width,height:844});
 const catalog=publication('sequence');
 updateCourse(catalog,'python-fundamentos',course=>{course.topics[0].example='for paso in range(1, 4):\n    print("Paso", paso)\nprint("Listo")';course.topics[0].walkthrough=sequence;});
 await serveCatalog(context,catalog); await page.goto('/'); await enterCourse(page);
 await expect(page.getByRole('heading',{name:'Secuencia'})).toBeVisible();
 const diagram=page.locator('.walkthrough-diagram');
 await expect(diagram.locator('.walkthrough-element')).toHaveText(['Inicio','Vuelta 1','Vuelta 2','Vuelta 3','Final']);
 await page.getByRole('button',{name:'Siguiente',exact:true}).click();
 await expect(page.getByLabel('Salida del recorrido')).toHaveText('Paso 1');
 await page.getByRole('button',{name:'Final',exact:true}).click();
 await expect(page.getByLabel('Salida del recorrido')).toHaveText('Paso 1\nPaso 2\nPaso 3\nListo');
 await expect(page.getByText('Termina el programa.')).toBeVisible();
 await expect(page.getByLabel('Código del recorrido').locator('.active')).toHaveText('print("Listo")\n');
 await page.getByRole('button',{name:'Anterior',exact:true}).click();
 await expect(page.getByLabel('Salida del recorrido')).toHaveText('Paso 1\nPaso 2\nPaso 3');
 await page.getByRole('button',{name:'Vuelta 2',exact:true}).click();
 await expect(page.getByLabel('Salida del recorrido')).toHaveText('Paso 1\nPaso 2');
});
for (const [name, mutate] of [['unknown reference', w => { w.steps[0].element='missing'; }], ['invalid line', w => { w.steps[0].line=999; }]]) test(`invalid sequence ${name} preserves the saved publication`, async ({page,context}) => {
 await page.goto('/'); await expect(page.getByRole('button',{name:'Explorar Primeros pasos con Python'})).toBeVisible();
 const old=await page.evaluate(()=>localStorage.getItem('python-tutor:catalog:v1'));
 const next=publication('invalid-sequence'); updateCourse(next,'python-fundamentos',course=>{course.topics[0].walkthrough=structuredClone(sequence);mutate(course.topics[0].walkthrough);});
 await serveCatalog(context,next); await page.reload();
 await expect(page.getByRole('alert')).toContainText('No se pudo actualizar el catálogo');
 expect(await page.evaluate(()=>localStorage.getItem('python-tutor:catalog:v1'))).toBe(old);
});

test('sequence keeps diagram and step order independent with repeated visits', async ({page,context}) => {
 const catalog=publication('independent-sequence');
 updateCourse(catalog,'python-fundamentos',course=>{course.topics[0].walkthrough={type:'sequence',elements:[{id:'a',label:'A'},{id:'b',label:'B'},{id:'unused',label:'Sin pasos'}],steps:[{element:'b',line:1,explanation:'Primero',output:'Uno'},{element:'a',line:1,explanation:'Segundo',output:'Dos'},{element:'b',line:1,explanation:'Tercero',output:'Tres'}]};});
 await serveCatalog(context,catalog); await page.goto('/'); await enterCourse(page);
 await expect(page.locator('.walkthrough-diagram .walkthrough-element')).toHaveText(['A','B','Sin pasos']);
 await page.getByRole('button',{name:'Siguiente',exact:true}).click();
 await expect(page.getByLabel('Salida del recorrido')).toHaveText('Uno\nDos');
 await page.getByRole('button',{name:'B',exact:true}).click();
 await expect(page.getByLabel('Salida del recorrido')).toHaveText('Uno');
});
