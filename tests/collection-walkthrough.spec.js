import { test, expect, enterCourse, publication, serveCatalog, updateCourse } from './fixtures/catalog.js';
import collection from './fixtures/collection.json' with { type: 'json' };

const example = 'colores = ["rojo", "azul"]\ncolores.append("verde")\nprint(colores[0])\n\nlibro = {"titulo": "Python", "paginas": 100}\nprint(libro["titulo"])';
for (const width of [390, 1280]) test(`collection follows the example at ${width}px`, async ({page,context}) => {
 await page.setViewportSize({width,height:844});
 const catalog=publication('collection');
 updateCourse(catalog,'python-fundamentos',course=>{course.topics[0].example=example;course.topics[0].walkthrough=collection;});
 await serveCatalog(context,catalog); await page.goto('/'); await enterCourse(page);
 await expect(page.getByRole('heading',{name:'Colección'})).toBeVisible();
 const diagram=page.locator('.walkthrough-diagram');
 await expect(diagram.getByLabel('Lista').locator('.walkthrough-entry')).toHaveText(['0rojo','1azul']);
 await expect(diagram.getByLabel('Diccionario').locator('.walkthrough-entry')).toHaveText(['tituloPython','paginas100']);
 await page.getByRole('button',{name:'Siguiente',exact:true}).click();
 await expect(diagram.getByLabel('Lista').locator('.walkthrough-entry')).toHaveText(['0rojo','1azul','2verde']);
 await expect(diagram.getByLabel('Diccionario').locator('.walkthrough-entry')).toHaveText(['tituloPython','paginas100']);
 await expect(diagram.getByRole('button',{name:'2: verde'})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByText('append añade verde al final de colores.')).toBeVisible();
 await expect(page.getByLabel('Código del recorrido').locator('.active')).toHaveText('colores.append("verde")\n');
 await page.getByRole('button',{name:'Siguiente',exact:true}).click();
 await expect(page.getByLabel('Salida del recorrido')).toHaveText('rojo');
 await expect(page.getByLabel('Código del recorrido').locator('.active')).toHaveText('print(colores[0])\n');
 await page.getByRole('button',{name:'Siguiente',exact:true}).click();
 await expect(page.getByLabel('Salida del recorrido')).toHaveText('rojo\nPython');
 await expect(page.getByText('La clave titulo consulta el valor Python.')).toBeVisible();
 await page.getByRole('button',{name:'Anterior',exact:true}).click();
 await expect(page.getByLabel('Salida del recorrido')).toHaveText('rojo');
 await diagram.getByRole('button',{name:'titulo: Python'}).click();
 await expect(page.getByLabel('Salida del recorrido')).toHaveText('rojo\nPython');
});
for (const [name, mutate] of [['empty group',w=>w.groups[0].elements=[]],['duplicate element',w=>w.groups[1].elements[0].id='rojo'],['unknown reference',w=>w.steps[0].element='missing'],['invalid line',w=>w.steps[0].line=999],['invalid introduction',w=>w.groups[0].elements[2].introducedAt=999],['reference before introduction',w=>w.steps[0].element='verde']]) test(`invalid collection ${name} preserves the saved publication`, async ({page,context}) => {
 await page.goto('/'); await expect(page.getByRole('button',{name:'Explorar Primeros pasos con Python'})).toBeVisible();
 const old=await page.evaluate(()=>localStorage.getItem('python-tutor:catalog:v1'));
 const next=publication('invalid-collection'); updateCourse(next,'python-fundamentos',course=>{course.topics[0].walkthrough=structuredClone(collection);mutate(course.topics[0].walkthrough);});
 await serveCatalog(context,next); await page.reload();
 await expect(page.getByRole('alert')).toContainText('No se pudo actualizar el catálogo');
 expect(await page.evaluate(()=>localStorage.getItem('python-tutor:catalog:v1'))).toBe(old);
});
