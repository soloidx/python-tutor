import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPersonalExecutor } from '../../src/personalExecutor.js';

test('el ejecutor exige un origen separado y una configuración explícita', () => {
  assert.throws(() => createPersonalExecutor({ origin: 'https://app.example', appOrigin: 'https://app.example' }));
  assert.throws(() => createPersonalExecutor({ origin: '', appOrigin: 'https://app.example' }));
});

test('el cliente ignora mensajes ajenos, terminales fuera de fase y veredictos enviados', async () => {
  let handler;
  const sent = [];
  const frame = {contentWindow:{postMessage:(message)=>sent.push(message)},remove(){}};
  const previous = {document:globalThis.document,addEventListener:globalThis.addEventListener,removeEventListener:globalThis.removeEventListener};
  globalThis.document = {createElement:()=>frame,body:{append(){}}};
  globalThis.addEventListener = (_name, fn) => {handler=fn};
  globalThis.removeEventListener = () => {};
  try {
    const executor=createPersonalExecutor({origin:'https://executor.example',appOrigin:'https://app.example'});
    const deliver=(data,origin='https://executor.example',source=frame.contentWindow)=>handler({origin,source,data});
    deliver({v:1,type:'executor-ready'});
    const result=executor.run('x=42',[{kind:'variable',name:'x',equals:42}]);
    const id=sent[0].id;
    deliver({v:1,id,type:'observations',output:'',variables:{x:{type:'number',value:42}}});
    deliver({v:1,id,type:'loading'},'https://other.example');
    deliver({v:1,id,type:'loading'});
    deliver({v:1,id,type:'running',version:'0.28.3'});
    deliver({v:1,id,type:'observations',output:'',variables:{x:{type:'number',value:41}},passed:true});
    deliver({v:1,id,type:'observations',output:'',variables:{x:{type:'number',value:41}}});
    assert.equal((await result).status,'rejected');
    assert.deepEqual(sent[0].names,['x']);
    assert.equal(Object.hasOwn(sent[0],'rules'),false);
    executor.close();
  } finally { Object.assign(globalThis,previous); }
});
