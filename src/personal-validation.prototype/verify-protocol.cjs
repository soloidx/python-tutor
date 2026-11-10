/* Regression fixtures for actual protocol handlers; not a Python security certification. */
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const {MessageChannel}=require('worker_threads');
const root=__dirname;
const scripts=file=>[...fs.readFileSync(root+'/'+file,'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const turn=()=>new Promise(r=>setTimeout(r,10));
function pageHarness(){
 const nodes=new Map(),listeners={};
 const element=()=>({value:'',textContent:'',disabled:false,children:[],append(...n){this.children.push(...n)},replaceChildren(...n){this.children=n},setAttribute(){},contentWindow:{postMessage(){}}});
 const node=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)};
 const context=vm.createContext({document:{getElementById:node,createElement:element},location:{origin:'http://127.0.0.1:8871'},crypto:require('crypto').webcrypto,addEventListener:(name,fn)=>listeners[name]=fn,setTimeout:()=>1,clearTimeout(){},console});
 vm.runInContext(fs.readFileSync(root+'/protocol.js','utf8'),context);
 for(const script of scripts('index.html'))vm.runInContext(script.replaceAll('__EXECUTOR_ORIGIN__','http://127.0.0.1:8872'),context);
 const deliver=data=>listeners.message({origin:'http://127.0.0.1:8872',source:node('executor').contentWindow,data});
 deliver({v:1,type:'executor-ready'});vm.runInContext('run()',context);
 return {context,node,deliver,read:code=>vm.runInContext(code,context)};
}
function executorHarness(options={}){
 const listeners={},workers=[],timers=new Map();let timerId=0;
 class FakeWorker{
  constructor(){this.messages=[];workers.push(this)}
  postMessage(data){this.messages.push(data);if(data.port){this.port=data.port;this.port.onmessage=e=>this.messages.push(e.data);this.port.start();}}
  terminate(){this.terminated=true;this.port?.close();}
  deliver(data){if(this.port)this.port.postMessage(data);else this.onmessage?.({data});}
 }
 const parent={messages:[],postMessage(message){this.messages.push(message)}},context=vm.createContext({parent,Worker:FakeWorker,MessageChannel,AbortController,TextDecoder,ArrayBuffer,fetch:options.fetch || (async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)})),setTimeout:(fn,delay)=>{const id=++timerId;timers.set(id,{fn,delay});return id},clearTimeout:id=>timers.delete(id),addEventListener:(name,fn)=>listeners[name]=fn,console});
 vm.runInContext(fs.readFileSync(root+'/protocol.js','utf8'),context);
 for(const script of scripts('executor.html'))vm.runInContext(script.replaceAll('__APP_ORIGIN__','http://127.0.0.1:8871'),context);
 return {workers,timers,parent,deliver:data=>listeners.message({origin:'http://127.0.0.1:8871',source:parent,data}),close:()=>workers.forEach(w=>{w.port?.close();w.messages.find(m=>m.port)?.port.close();})};
}
(async()=>{
 const results=[];
 async function check(name,fn){try{await fn();results.push({name,pass:true})}catch(e){results.push({name,pass:false,error:e.message})}}
 await check('Los nombres deben ser texto',()=>{const h=pageHarness();assert.throws(()=>h.read('RuleProfile.parse(\'[ {"kind":"variable","name":true,"equals":42} ]\')'));});
 await check('Un mensaje desconocido no consume la sesión',()=>{const h=pageHarness();const id=h.read('active.id');h.deliver({v:1,type:'ordinary-unknown-fixture',id});assert.equal(h.read('active?.id'),id);});
 await check('Cancelar espera confirmación',()=>{const h=pageHarness();h.read('cancel()');assert.equal(h.node('verdict').textContent,'Cancelando');assert.ok(h.read('active'));});
 await check('Ready duplicado no reenvía run ni renueva el plazo',async()=>{const h=executorHarness();try{await h.deliver({v:1,type:'execute',id:'fixture-run',code:'respuesta = 42',names:['respuesta']});const w=h.workers[0];w.deliver({v:1,type:'ready',version:'0.28.3'});await turn();const timer=[...h.timers.keys()][0];w.deliver({v:1,type:'ready',version:'0.28.3'});await turn();assert.equal(w.messages.filter(m=>m.type==='run').length,1);assert.equal([...h.timers.keys()][0],timer);}finally{h.close()}});
 await check('El supervisor usa un puerto privado',async()=>{const h=executorHarness();try{await h.deliver({v:1,type:'execute',id:'fixture-channel',code:'respuesta = 42',names:['respuesta']});assert.ok(h.workers[0].messages[0].port);}finally{h.close()}});

 await check('Un terminal fuera de fase no cierra la carga',async()=>{const h=executorHarness();try{await h.deliver({v:1,type:'execute',id:'fixture-phase',code:'respuesta = 42',names:['respuesta']});const w=h.workers[0];w.deliver({v:1,type:'observations',output:'42',variables:{respuesta:{type:'number',value:42}}});await turn();assert.ok(!w.terminated);assert.ok(!h.parent.messages.some(m=>m.type==='observations'));w.deliver({v:1,type:'ready',version:'0.28.3'});await turn();assert.equal(w.messages.filter(m=>m.type==='run').length,1);}finally{h.close()}});
 await check('Una ejecución duplicada no reemplaza el worker',async()=>{const h=executorHarness();try{const request={v:1,type:'execute',id:'fixture-duplicate',code:'respuesta = 42',names:['respuesta']};await h.deliver(request);const timer=[...h.timers.keys()][0];await h.deliver(request);assert.equal(h.workers.length,1);assert.equal([...h.timers.keys()][0],timer);}finally{h.close()}});
 await check('Se ignoran errores fuera del esquema',()=>{const h=pageHarness();const id=h.read('active.id');h.deliver({v:1,type:'load-error',id,message:'ordinary fixture without required output'});assert.equal(h.read('active?.id'),id);});
 await check('El acuse completa la cancelación',()=>{const h=pageHarness();const id=h.read('active.id');h.read('cancel()');h.deliver({v:1,type:'cancelled',id});assert.equal(h.read('active'),null);assert.equal(h.node('verdict').textContent,'Cancelado');});
 await check('Cancelar aborta la precarga antes de crear worker',async()=>{let release;const waiting=new Promise(resolve=>release=resolve),signals=[];const h=executorHarness({fetch:async(_url,{signal})=>{signals.push(signal);await waiting;return{ok:true,arrayBuffer:async()=>new ArrayBuffer(4)}}});try{const loading=h.deliver({v:1,type:'execute',id:'fixture-abort',code:'respuesta = 42',names:[]});await turn();await h.deliver({v:1,type:'cancel',id:'fixture-abort'});assert.ok(signals.every(signal=>signal.aborted));assert.equal(h.parent.messages.at(-1).type,'cancelled');release();await loading;assert.equal(h.workers.length,0);}finally{release();h.close()}});
 await check('Las observaciones exigen tipos y campos cerrados',()=>{const h=pageHarness();assert.equal(h.read('ValidationProtocol.workerReply({v:1,type:"observations",output:"42",variables:{respuesta:{type:"number",value:"42"}}})'),false);assert.equal(h.read('ValidationProtocol.workerReply({v:1,type:"observations",output:"42",variables:{},extra:1})'),false);});
 await check('El canal público del worker no procesa respuestas',async()=>{const h=executorHarness();try{await h.deliver({v:1,type:'execute',id:'fixture-private',code:'respuesta = 42',names:[]});assert.equal(h.workers[0].onmessage,undefined);assert.ok(h.workers[0].port);}finally{h.close()}});
 console.log(JSON.stringify(results,null,2));process.exitCode=results.every(r=>r.pass)?0:1;
})().catch(e=>{console.error(e);process.exitCode=1});
