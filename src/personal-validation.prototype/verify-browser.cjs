/* Functional and native-policy conformance; no Python manipulation payloads. */
const path=require('path'),{execFileSync}=require('child_process'),{createRequire}=require('module');
const commonRoot=path.dirname(execFileSync('git',['rev-parse','--path-format=absolute','--git-common-dir'],{cwd:__dirname,encoding:'utf8'}).trim());
const dependency=createRequire(path.join(commonRoot,'package.json'));
const {chromium,firefox,webkit}=dependency('playwright');
const baseURL=process.env.PROTOTYPE_URL || 'http://127.0.0.1:8871';
const fs=require('fs'),assert=require('assert/strict');
(async()=>{
 const results=[];
 for(const [name,engine,options] of [['Chrome',chromium,{channel:'chrome'}],['Firefox',firefox,{}],['WebKit',webkit,{}]]){
  if(process.env.PROTOTYPE_ENGINES && !process.env.PROTOTYPE_ENGINES.split(',').includes(name))continue;
 const browser=await engine.launch({headless:true,...options});
 try {
  const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const checks=[];
  await page.goto(baseURL);await page.waitForFunction(()=>!document.querySelector('#run').disabled);
  const executorOrigin=new URL(await page.locator('#executor').getAttribute('src')).origin;
  const child=page.frames().find(f=>f.url().startsWith(executorOrigin+'/'));
  const runtimePolicy=(await context.request.get(executorOrigin+'/worker.js')).headers()['content-security-policy'];
  const fixturePolicy=(await context.request.get(executorOrigin+'/policy-conformance.js')).headers()['content-security-policy'];
  assert.equal(runtimePolicy,fixturePolicy);assert.ok(runtimePolicy.includes("connect-src 'none'"));assert.ok(runtimePolicy.includes("worker-src 'none'"));
  await page.evaluate(()=>localStorage.setItem('prototype:synthetic-marker','fixture-only'));
  const isolated=await child.evaluate(()=>{let parentAccess;try{parentAccess=parent.document.title}catch(e){parentAccess=e.name}return{parentAccess,marker:localStorage.getItem('prototype:synthetic-marker')}});
  assert.equal(isolated.parentAccess,'SecurityError');assert.equal(isolated.marker,null);checks.push({name:'Separate origin',...isolated});
  const policy=await child.evaluate(()=>new Promise((resolve,reject)=>{const worker=new Worker('/policy-conformance.js');const timer=setTimeout(()=>{worker.terminate();reject(new Error('Policy fixture timed out'))},5000);worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(new Error(e.message))};worker.onmessage=e=>{clearTimeout(timer);worker.terminate();resolve(e.data)};worker.postMessage({type:'check'});}));
  assert.equal(policy.connection,'denied');assert.equal(policy.childWorker,'denied');assert.ok(policy.violations.includes('connect-src'));assert.ok(policy.violations.includes('worker-src'));checks.push({name:'Native policy',...policy});
  for(const [scenario,expected] of [['Aprueba','Aprobado'],['Rechaza','No aprobado'],['Error','Error de Python'],['Tipo no admitido','Tipo no admitido'],['Límite de salida','Límite excedido'],['Regla no admitida','Regla no admitida']]){
   await page.getByRole('tab',{name:scenario,exact:true}).click();await page.locator('#run').click();await page.waitForFunction(()=>!['Pendiente','Sin ejecutar'].includes(document.querySelector('#verdict').textContent),{timeout:55000});const actual=await page.locator('#verdict').innerText();assert.equal(actual,expected);checks.push({name:scenario,actual});
  }
  await page.getByRole('tab',{name:'Cancelar y recuperar',exact:true}).click();await page.locator('#run').click();await page.waitForFunction(()=>document.querySelector('#stage').textContent.startsWith('Ejecutando'));await page.locator('#cancel').click();await page.waitForFunction(()=>document.querySelector('#verdict').textContent==='Cancelado');assert.ok((await page.locator('#detail').innerText()).includes('confirmó'));checks.push({name:'Confirmed cancellation',actual:'Cancelado'});
  await page.locator('#reset').click();await page.locator('#run').click();await page.waitForFunction(()=>document.querySelector('#verdict').textContent==='Aprobado',{timeout:55000});checks.push({name:'Recovery',actual:'Aprobado'});
  await page.locator('#code').fill('import asyncio\nawait asyncio.sleep(12)\nrespuesta = 42');await page.locator('#rules').fill(JSON.stringify([{kind:'variable',name:'respuesta',equals:42}]));await page.locator('#run').click();await page.waitForFunction(()=>document.querySelector('#stage').textContent.startsWith('Ejecutando'));const start=Date.now();await page.waitForFunction(()=>document.querySelector('#verdict').textContent==='Tiempo excedido',{timeout:15000});checks.push({name:'Deadline',elapsedMs:Date.now()-start});
  await page.locator('#reset').click();await page.locator('#run').click();await page.waitForFunction(()=>document.querySelector('#verdict').textContent==='Aprobado',{timeout:55000});checks.push({name:'Recovery after deadline',actual:'Aprobado'});
  results.push({name,version:browser.version(),checks,errors});console.log(JSON.stringify(results.at(-1),null,2));await context.close();
 } finally { await browser.close(); }
 }
 if(process.env.PROTOTYPE_RESULTS)fs.writeFileSync(process.env.PROTOTYPE_RESULTS,JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
