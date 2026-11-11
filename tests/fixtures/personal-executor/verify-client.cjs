const path = require('path'), {execFileSync} = require('child_process'), {createRequire} = require('module');
const common = path.dirname(execFileSync('git',['rev-parse','--path-format=absolute','--git-common-dir'],{cwd:__dirname,encoding:'utf8'}).trim());
const {chromium} = createRequire(path.join(require('fs').existsSync(path.resolve(__dirname,'../../../node_modules/playwright'))?path.resolve(__dirname,'../../..'):common,'package.json'))('playwright');
const assert = require('assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try {
  const page=await browser.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8871/client.html');
  await page.waitForFunction(()=>window.statusHistory?.includes('ready'));
  const run=(code,rules)=>page.evaluate(({code,rules})=>window.executor.run(code,rules),{code,rules});
  const rules=[{kind:'variable',name:'x',equals:42},{kind:'stdout',equals:'42'}];
  assert.equal((await run('x=42\nprint(x)',rules)).status,'accepted');
  assert.equal((await run('x=41\nprint(x)',rules)).status,'rejected');
  assert.equal((await run('x=',rules)).status,'execution-error');
  assert.equal((await run('x=[]',rules)).status,'unsupported');
  assert.equal((await run('print("x" * 20001)',[{kind:'stdout',equals:'x'}])).status,'limit');
  await page.evaluate(()=>{window.pending=window.executor.run('x=sum(range(100_000_000))',[{kind:'variable',name:'x',equals:42}]);});
  await page.waitForFunction(()=>window.statusHistory.at(-1)==='running');
  await page.evaluate(()=>window.executor.cancel());
  assert.equal((await page.evaluate(()=>window.pending)).status,'cancelled');
  assert.equal((await run('x=42\nprint(x)',rules)).status,'accepted');
  assert.deepEqual(errors,[]);
  console.log('Contrato real: aceptación, rechazo, error, perfil, límite, cancelación y recuperación correctos.');
 } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
