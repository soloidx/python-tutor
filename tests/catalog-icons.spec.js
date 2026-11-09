import {createHash} from 'node:crypto';
import {test,expect,publication,updateCourse,serveCatalog,sourceBase} from './fixtures/catalog.js';
const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="8" y="8" width="48" height="48" fill="#2563eb"/></svg>';
function withIcons(source=svg,revision='icons-1'){
 const value=publication(revision);
 const file=revision === 'icons-1' ? 'icons/custom.svg' : `icons/custom.${revision}.svg`;
 const icon={file,sha256:createHash('sha256').update(source).digest('hex')};
 value.files[file]=source;
 value.catalog.learningPaths[0].icon=icon;
 updateCourse(value,'python-fundamentos',course=>{course.icon=icon;course.topics[0].icon=icon;});
 return value;
}
test('custom SVG icons render on paths, courses and topics and survive an offline reload from backup',async({page,context})=>{
 await serveCatalog(context,withIcons());await page.goto('/');
 const custom=page.locator('img');
 await expect(custom.first()).toHaveAttribute('src',new RegExp(encodeURIComponent('#2563eb')));
 expect(await custom.first().evaluate(n=>n.complete && n.naturalWidth>0)).toBe(true);
 await page.getByRole('button',{name:'Explorar Primeros pasos con Python',exact:true}).click();
 await expect(page.locator('main img').first()).toHaveAttribute('src',new RegExp(encodeURIComponent('#2563eb')));
 await page.getByRole('button',{name:'Ver temas de Python Fundamentos',exact:true}).click();
 await expect(page.locator('main img').nth(1)).toHaveAttribute('src',new RegExp(encodeURIComponent('#2563eb')));
 await context.route(`${sourceBase}**`,r=>r.abort());await page.reload();
 await expect(page.getByRole('heading',{name:'Cursos y rutas de aprendizaje'})).toBeVisible();
 await expect(page.locator('main img').first()).toHaveAttribute('src',new RegExp(encodeURIComponent('#2563eb')));
});
for(const [name,source] of Object.entries({
 script:svg.replace('<rect','<script>alert(1)</script><rect'),
 event:svg.replace('<rect','<rect onload="alert(1)"'),
 external:svg.replace('<rect','<image href="https://example.com/tracker"/><rect'),
 css:svg.replace('<rect','<style>svg{fill:red}</style><rect'),
 doctype:'<!DOCTYPE svg [<!ENTITY data "example">]>'+svg,
 malformed:svg.slice(0,-6),
 reference:svg.replace('#2563eb','url(https://example.com/paint)'),
}))test(`rejects the complete publication for unsupported SVG: ${name}`,async({page,context})=>{
 await serveCatalog(context,withIcons(source));await page.goto('/');
 await expect(page.getByRole('alert')).toContainText('No se pudo cargar el catálogo');
 await expect(page.getByRole('button',{name:/Explorar/})).toHaveCount(0);
});
for(const mode of ['checksum','escape','missing'])test(`rejects SVG ${mode}`,async({page,context})=>{
 const value=withIcons();
 if(mode==='checksum')value.files['icons/custom.svg']=svg.replace('2563eb','00ff00');
 if(mode==='escape')value.catalog.learningPaths[0].icon.file='../icon.svg';
 if(mode==='missing')delete value.files['icons/custom.svg'];
 await serveCatalog(context,value);await page.goto('/');
 await expect(page.getByRole('alert')).toContainText('No se pudo cargar el catálogo');
});
test('a damaged saved SVG is never activated when the source is unavailable',async({page,context})=>{
 await serveCatalog(context,withIcons());await page.goto('/');
 await expect(page.getByRole('button',{name:'Explorar Primeros pasos con Python',exact:true})).toBeVisible();
 await page.evaluate(()=>{const key='python-tutor:catalog:v1';const saved=JSON.parse(localStorage.getItem(key));saved.iconFiles['icons/custom.svg']='<svg/>';localStorage.setItem(key,JSON.stringify(saved));});
 await context.route(`${sourceBase}**`,r=>r.abort());await page.reload();
 await expect(page.getByRole('alert')).toContainText('No se pudo cargar el catálogo');
});

test('invalid SVG updates preserve the active icons; valid replacements wait for reload',async({page,context})=>{
 await serveCatalog(context,withIcons());await page.goto('/');
 await expect(page.getByRole('button',{name:'Explorar Primeros pasos con Python',exact:true})).toBeVisible();
 await serveCatalog(context,withIcons(svg.replace('<rect','<script>alert(1)</script><rect'),'icons-2'));
 await page.reload();
 await expect(page.getByRole('alert')).toContainText('No se pudo actualizar el catálogo');
 await expect(page.locator('main img').first()).toHaveAttribute('src',new RegExp(encodeURIComponent('#2563eb')));
 await serveCatalog(context,withIcons(svg.replace('#2563eb','#16a34a'),'icons-2'));
 await page.getByRole('button',{name:'Reintentar',exact:true}).click();
 await expect(page.getByRole('button',{name:'Recargar para actualizar',exact:true})).toBeVisible();
 await expect(page.locator('main img').first()).toHaveAttribute('src',new RegExp(encodeURIComponent('#2563eb')));
 await page.getByRole('button',{name:'Recargar para actualizar',exact:true}).click();
 await expect(page.locator('main img').first()).toHaveAttribute('src',new RegExp(encodeURIComponent('#16a34a')));
});
