import {test,expect} from './fixtures/catalog.js';
import {setup,model} from './fixtures/tutor.js';

test('tutor formats Markdown once and keeps the composer outside its scrollable history',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);
 const answer='## Una variable\n\nUsa **un nombre claro** y `print()`.\n\n- Guarda un valor\n- Muestra el resultado\n\n| Nombre | Valor |\n| --- | --- |\n| edad | 7 |\n\n```python\nprint(7)\n```\n\n<script>window.injected=true</script>\n\n'+Array(40).fill('Un párrafo para practicar y revisar el resultado.').join('\n\n');
 await setup(page,model,answer);
 await page.getByLabel('Mensaje al tutor').fill('Explícame una variable');
 await page.getByRole('button',{name:'Enviar',exact:true}).click();
 const history=page.getByRole('region',{name:'Historial del tutor'});
 await expect(page.getByText('Respuesta completa',{exact:true})).toBeVisible();
 await expect(history.getByRole('heading',{name:'Una variable'})).toHaveCount(1);
 await expect(history.getByRole('table')).toHaveCount(1);
 await expect(history.getByRole('listitem')).toHaveCount(2);
 await expect(history.getByRole('button',{name:'Copiar código'})).toHaveCount(1);
 expect(await page.evaluate(()=>window.injected)).toBeUndefined();
 expect(await history.evaluate(n=>n.scrollHeight>n.clientHeight)).toBe(true);
 await history.evaluate(n=>n.scrollTop=0);
 await expect(page.getByLabel('Mensaje al tutor')).toBeInViewport();
 await history.getByRole('button',{name:'Copiar código'}).click();
 expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('print(7)\n');
});
