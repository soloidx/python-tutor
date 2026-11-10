# Aislamiento verificable de contenido generado con Pyodide 0.28.3

Investigación de [#80](https://github.com/soloidx/python-tutor/issues/80), 2026-11-10. Base: `4b640b05a2afe075f010dc4dac4f7a96b3556e6d`. Alcance: navegador, sitio estático, biblioteca estándar, sin claves LLM ni backend de ejecución. Este documento no implementa el generador ni modifica el runtime.

## Resultado y decisión pendiente

**Hay una integración mínima demostrada para arrancar Pyodide 0.28.3 sin destinos de red abiertos, pero no se ha obtenido un mecanismo suficiente para habilitar la validación automática bajo todas las condiciones acordadas.** En Chromium headless, un iframe de origen opaco creó un worker blob con CSP heredada y `connect-src 'none'`. Pyodide arrancó con assets públicos suministrados desde memoria. Los intentos ensayados de acceso al origen de la aplicación y de red quedaron bloqueados. Sin embargo, el código pudo importar `js`, crear otro worker blob, falsificar un mensaje de aprobación y alterar una función usada por la comprobación.

Por tanto, [#78](https://github.com/soloidx/python-tutor/issues/78) puede utilizar este resultado para planificar, pero no dar por satisfecho el requisito de ejecución aislada de [#77](https://github.com/soloidx/python-tutor/issues/77#issuecomment-6759539518). La investigación está terminada dentro de este alcance; la capacidad de producto sigue bloqueada por integridad del evaluador, restricción de capacidades y verificación en navegadores admitidos. No se propone omitir validación ni sustituirla por revisión manual como vía de incorporación.

## Modelo y base comprobada

Se trata como hostil todo Python generado: ejemplos, solución de referencia, caso incorrecto de validación y comprobaciones. El supervisor, loader, assets y políticas del navegador son confiables; se asume navegador actualizado sin vulnerabilidad explotable. No entran en el compartimento credenciales, historial, progreso, configuración del tutor, archivos del estudiante ni RPC que otorguen esas capacidades. Un nonce, ID de caso o hash de contenido identifica un mensaje; no demuestra que una comprobación se ejecutó correctamente.

En la base del repositorio, [`public/python-worker.js`](https://github.com/soloidx/python-tutor/blob/4b640b05a2afe075f010dc4dac4f7a96b3556e6d/public/python-worker.js) carga el runtime local, reutiliza intérprete, crea un diccionario por ejecución, limita el texto acumulado a 20.000 caracteres y ejecuta `bool(check)` en el espacio de la solución. Absorbe excepciones del check como `false`, por lo que no distingue un rechazo válido de un check roto. [`src/usePython.js`](https://github.com/soloidx/python-tutor/blob/4b640b05a2afe075f010dc4dac4f7a96b3556e6d/src/usePython.js) termina el worker tras 10 segundos y admite mensajes del worker sin autenticación del resultado. Un mensaje puede limpiar el temporizador; este protocolo no debe copiarse para contenido hostil. [`scripts/prepare-runtime.mjs`](https://github.com/soloidx/python-tutor/blob/4b640b05a2afe075f010dc4dac4f7a96b3556e6d/scripts/prepare-runtime.mjs) copia cinco assets al sitio. No hay frontera CSP/origen en ese worker.

## Qué sustentan las fuentes primarias

- **Origen opaco:** `sandbox="allow-scripts"` sin `allow-same-origin` conserva la ejecución de scripts y aplica el origen opaco. La separación de origen impide lectura directa del DOM y almacenamiento del padre; no es por sí misma una prohibición de red. El iframe supervisor no debe ejecutar Python ni JavaScript generado, crear elementos desde resultados ni navegar según instrucciones del worker. Véase [HTML, sandboxing y origen](https://html.spec.whatwg.org/multipage/browsers.html#sandboxing).
- **CSP:** las políticas se heredan en contextos locales como `srcdoc`/blob; la política debe existir antes de crear el worker. `connect-src` cubre conexiones; `script-src`, `worker-src`, `default-src` y `form-action` cubren otras rutas. `wasm-unsafe-eval` permite compilar WASM sin habilitar evaluación general de cadenas JavaScript. Una CSP permisiva durante bootstrap y retirada mediante un indicador JavaScript no acredita prohibición posterior. Consultado el [borrador oficial CSP3](https://www.w3.org/TR/CSP3/#security-inherit), especialmente [connect-src](https://www.w3.org/TR/CSP3/#directive-connect-src), [script-src](https://www.w3.org/TR/CSP3/#directive-script-src), [worker-src](https://www.w3.org/TR/CSP3/#directive-worker-src) y [meta](https://www.w3.org/TR/CSP3/#meta-element). Se cita como trabajo en progreso y se contrasta con una implementación real.
- **Bootstrap exacto:** el loader 0.28.3 acepta `lockFileContents`; permite precargar `pyodide.asm.js` y omitir su import dinámico si `_createPyodideModule` ya existe. No ofrece una opción pública documentada `wasmBinary`/`instantiateWasm` para suministrar todo el arranque. El código de [pyodide.ts versionado](https://github.com/pyodide/pyodide/blob/0.28.3/src/js/pyodide.ts) es la evidencia de ese camino, no una suposición sobre versiones posteriores.
- **Assets binarios:** [`emscripten-settings.ts`](https://github.com/pyodide/pyodide/blob/0.28.3/src/js/emscripten-settings.ts) construye la carga del WASM y de stdlib; [`compat.ts`](https://github.com/pyodide/pyodide/blob/0.28.3/src/js/compat.ts) utiliza `fetch` en navegador. Esto permite contrastar un adaptador de host que devuelve `Response` desde bytes ya recibidos, manteniendo el fetch nativo sujeto a CSP para cualquier otro destino. No se parcheó el archivo distribuido ni se cambió de versión.
- **JavaScript no es una frontera Python:** `jsglobals` configura lo visible en `import js` y por defecto es `globalThis`; su contrato no promete un sandbox seguro. Quitar ese import o suministrar `{}` puede reducir exposición, pero exige probar caminos alternativos y no acredita confinamiento. Véase [API JavaScript 0.28.3](https://pyodide.org/en/0.28.3/usage/api/js-api.html#loadPyodide). [`pyfetch`](https://pyodide.org/en/0.28.3/usage/api/python-api/http.html) es un wrapper de fetch, no una salida de red independiente de las políticas del navegador.
- **Terminación:** [`Worker.terminate()` y el algoritmo del worker](https://html.spec.whatwg.org/multipage/workers.html#dom-worker-terminate) permiten al dueño pedir el cierre sin cooperación del código Python. Los [interrupts de Pyodide 0.28.3](https://pyodide.org/en/0.28.3/usage/keyboard-interrupts.html) requieren configuración y SharedArrayBuffer; una excepción Python puede atraparse. Para este caso el supervisor debe poder desechar completamente el runtime.
- **Canales:** [HTML messaging](https://html.spec.whatwg.org/multipage/web-messaging.html#security-postmsg) exige validar origen y formato; un origen opaco serializa como `null`, compartido por muchos emisores. Comprobar `event.source`, instancia/ID y usar puertos privados limita emisores ajenos. Un puerto cuyo emisor está comprometido no autentica la semántica del resultado.

## Experimento descartable ejecutado

Se ejecutó el script del apéndice fuera del repositorio, en `/tmp/generated-isolation-experiment/run.cjs`. Sirvió únicamente assets públicos desde un servidor HTTP loopback efímero, sin estado del estudiante ni secretos. Se usaron los cinco archivos del paquete local `pyodide@0.28.3`; el nuevo worktree no instaló dependencias ni cambió el checkout principal. Playwright controló su propio navegador headless, sin CUA ni sesión del usuario.

Configuración ensayada:

```html
<iframe sandbox="allow-scripts"></iframe>
```

```text
default-src 'none'; script-src 'nonce-research' blob: 'wasm-unsafe-eval';
worker-src blob:; connect-src 'none'; base-uri 'none'; form-action 'none'
```

El nonce fijo sirve solo para la prueba. El padre carga los cinco assets; los transfiere como ArrayBuffers al iframe; este concatena un prelude confiable y los scripts originales `pyodide.asm.js` y `pyodide.js` en un worker blob. Un adaptador `fetch` devuelve `Response(bytes)` para los assets suministrados y delega cualquier otro destino al fetch nativo, que conserva la CSP. `lockFileContents` evita cargar el lockfile desde red. No hay caché como supuesto de seguridad, proxy de red o permiso temporal de destinos externos. El adaptador es una integración de host experimental, no una API de bytes oficial del loader; su comportamiento ante actualizaciones requiere nueva verificación.

Resultado de la corrida final: **Chromium headless 151.0.7922.34**, macOS ARM64; runtime informa **0.28.3**. Primer arranque incluida la precarga: **706 ms**; segundo arranque con iframe/worker nuevos y nueva precarga: **628 ms**. Son dos observaciones locales, no un benchmark ni presupuesto de producción. Firefox, WebKit, dispositivos móviles y hosting desplegado **no se probaron**.

| Prueba | Observado | Qué permite concluir |
| --- | --- | --- |
| `sum([1,2,3])` | `6` | Arranque y ejecución estándar mínimos funcionan. |
| `answer=42; answer==42` / `answer=0; answer==42` | `true` / `false` | Comparación normal acepta y rechaza antes de alterar el entorno. No acredita cobertura pedagógica. |
| Nombre inexistente en check | `NameError`, distinto de `false` | El runtime permite distinguir error y rechazo; el producto debe preservar esa distinción. |
| Iframe: `parent.document.title` y `localStorage.length` | `SecurityError`; origen `null` | Esas lecturas del origen del padre fallaron. No se introdujeron credenciales reales. |
| Python: `import js; js.location.origin` | `null` | JavaScript sigue accesible. No se cumple una prohibición literal de todas las APIs del navegador. |
| Python: fetch / pyfetch / XHR a loopback | Excepciones; violaciones `connect-src` | Las rutas probadas quedaron bloqueadas antes de llegar al servidor. |
| WebSocket a puerto loopback válido | Estado `3` (cerrado), violación `connect-src`; sin upgrade HTTP | Construir el objeto no significa conectar; se comprobó el cierre y la ausencia de handshake. |
| importScripts / import dinámico mediante función confiable del prelude | Excepciones, violaciones `script-src-elem` | Las dos cargas HTTP ensayadas fallaron. El import dinámico no se probó indirectamente mediante eval. |
| `js.indexedDB.open('probe')` | `SecurityError` | IndexedDB del origen de la app no estuvo disponible en ese contexto. |
| Crear un worker blob adicional y terminarlo | Permitido | `worker-src blob:` también alcanza descendientes; no basta para limitar al único worker previsto. No se ensayó proliferación. |
| `js.postMessage(JSON.parse('{"type":"result","passed":true}'))` | Llega una aprobación inventada antes del resultado auténtico | Reenviar ciegamente mensajes no acredita validación. |
| `builtins.bool=lambda _:True; answer=0; bool(answer==42)` | `true` | La solución puede corromper el evaluador dentro de la misma VM. Un canal privado por sí solo no arregla esto. |
| Bucle `while True: pass`, cancelado desde supervisor a los 300 ms | Terminación confirmada en 8 ms; título de UI aún consultable | Cancelación mínima independiente del worker funciona en esta corrida. No acredita temporizadores adversariales ni resistencia general a DoS. |
| Crear archivo `/tmp/probe`, alterar bool; destruir marco y worker; arrancar otros | Archivo ausente y `bool(0)==False` | Estado limpio observado tras recreación completa. Cambiar solamente `globals` no basta. |

El servidor recibió exactamente dos juegos de `/` y los cinco assets, más `/positive-control` emitido deliberadamente por el padre después de las pruebas. No recibió `/network-probe`, `/pyfetch-probe`, `/xhr-probe`, `/import-probe`, `/dynamic-probe` ni upgrades de WebSocket. El control positivo devolvió HTTP 200. Se capturaron seis eventos `securitypolicyviolation` dentro del worker: cuatro `connect-src` y dos `script-src-elem`. No se dependió solo de ausencia de solicitudes ni de un error que también pudiera deberse a CORS. Esta telemetría proviene de un probe cooperativo: no constituye evidencia autenticada contra un programa que decida falsificarla.

## Obstáculos que siguen abiertos

### Integridad del resultado

La frontera de origen/CSP protege al usuario frente a determinadas capacidades; no protege al check frente a la solución con la que comparte intérprete. Incluso ocultando el emisor, la solución puede modificar builtins, módulos, objetos usados por el check, trazas o estado global. Los checks también son código generado y no tienen por qué ser honestos. [La documentación de `exec` de Python 3.13](https://docs.python.org/3.13/library/functions.html#exec) advierte explícitamente que reemplazar `__builtins__` no es un mecanismo de seguridad.

Hace falta especificar qué evidencia es confiable: por ejemplo, un supervisor externo que ejecute un protocolo de pruebas definido y evalúe observaciones primitivas serializadas bajo un esquema, o una frontera de ejecución adicional donde código y evaluador no compartan autoridad. **Esas son rutas de investigación, no soluciones demostradas aquí.** Serializar objetos arbitrarios o confiar en `passed` de un worker vuelve a introducir la misma confianza; además, restringir checks Python a un lenguaje declarativo cambiaría el contrato y necesita decisión explícita. La revisión pedagógica automática sigue siendo evidencia limitada, aun con un canal técnicamente auténtico.

### Capacidades necesarias frente a “sin funciones del navegador”

El runtime requiere JavaScript, WebAssembly, memoria, temporización, comunicación y operaciones de archivos virtuales. La integración usa `Blob`, Worker, ArrayBuffer y Response para inicializarlo. La prohibición de **todas** las funciones del navegador requiere distinguir las funciones internas del runtime de las accesibles al Python hostil; esta prueba mantiene `js` accesible. No se reinterpretará unilateralmente #77 como autorización para ello.

Debe precisarse con el usuario si la propiedad buscada es ausencia de capacidades privilegiadas/red/datos de la app, permitiendo APIs internas controladas, o ausencia de toda API de navegador visible al Python. Para la segunda no se demostró una integración suficiente. Para la primera aún falta enumerar y bloquear capacidades adicionales, incluyendo workers descendientes y manipulación del canal. Ni una lista negra de nombres ni `jsglobals={}` sustituyen una frontera con propiedades verificadas.

### Tiempo, salida, mensajes y memoria

El supervisor confiable debe mantener el reloj de diez segundos sin que mensajes intermedios lo reinicien, invalidar por límite y terminar todo el compartimento. Se ensayó cancelación, no el timeout automático completo ni interferencia adversarial con cada callback. Los IDs deben ligar resultado, fase, caso y contenido exacto; una cancelación impide aceptar mensajes tardíos.

El límite de 20.000 caracteres debe invalidar el caso, no solo truncar silenciosamente. Debe abarcar stdout, stderr y payloads; no basta recortar después de recibir un mensaje enorme. Conviene que el runtime acumule y envíe un único resultado acotado mediante una referencia de envío privada y que el supervisor imponga un máximo de mensajes/tamaño. **No se demostró ese canal privado ni una cota previa a la clonación/cola de mensajes.** El probe descarta stdout y usa mensajes pequeños; no se ejecutó una inundación. Con `js.postMessage` accesible, un emisor puede ignorar las cuotas del harness.

El `pyodide.asm.js` distribuido localmente contiene memoria WASM inicial de 20 MiB y máximo de 65.536 páginas (4 GiB). No es una cuota de RAM total del worker, iframe, proceso ni pestaña. La [interfaz WebAssembly.Memory](https://webassembly.github.io/spec/js-api/index.html#memories) distingue límites de esa memoria y crecimiento; el resto de asignaciones JavaScript/objetos/salidas quedan fuera. No se encontró una opción pública documentada 0.28.3 para imponer una cuota dura total. No se hizo una prueba de agotamiento. Estado limpio exige runtime nuevo por caso, y aun así la presión de memoria puede afectar al navegador antes de actuar un temporizador.

## Rutas candidatas y prueba que falta

| Ruta | Evidencia actual | Bloqueo para adoptarla |
| --- | --- | --- |
| Worker actual del origen de la app | Código existente y temporizador | No separa origen, red, resultados ni estado global. Descartado como prueba de aislamiento. |
| Iframe opaco + CSP + worker blob + assets en memoria | Arranque y controles mínimos en Chromium | Integridad del evaluador, APIs accesibles, workers descendientes, cuotas de salida/mensajes, Firefox/WebKit y despliegue real. |
| Cambiar `jsglobals` o bloquear importaciones | Configuración soportada; sin garantía de seguridad | Analizar vías alternativas y semántica del runtime. No aceptable como único control. |
| Supervisor externo + protocolo de observaciones/checks limitado | Diseño posible, sin spike | Decidir contrato, serialización y autoridad; probar corrupción del evaluador y falsificación. |
| Aislamiento de procesos/servicio externo | Fuera del alcance sin backend | No se propone ni se supone disponible. |

Antes de habilitar: acordar semántica de capacidades y checks; demostrar autoridad independiente del resultado; cerrar creación de descendientes/egresos no enumerados; aplicar reloj, cancelación y límites que fallen cerrados; recrear el runtime por caso; ejecutar una suite adversarial acotada en navegadores y hosting soportados. Debe incluir referencias e incorrectos reales, fallos del código/check diferenciados, mensajes falsos/tardíos, cambios de builtins/módulos, escape a JS, cancelación con manejadores alterados y recuperación de UI, sin agotar memoria deliberadamente. Si una propiedad no puede demostrarse en un navegador, la ejecución automática no debe habilitarse allí bajo la garantía acordada.

Certeza **alta** para los comportamientos observados y la insuficiencia del harness compartido; **media** para la ruta de bootstrap como integración mantenible, porque depende del comportamiento versionado y solo se probó en un motor; **no demostrada** para aislamiento integral, autenticidad semántica, cuota dura de memoria y resistencia general a DoS.

## Reproducción y evidencia

La única incorporación a la rama es este Markdown. No hay cambios de producto, contrato remoto ni assets. Para reproducir, extraer el bloque JavaScript siguiente a un archivo `.cjs`, ajustar `root`, el require de Playwright y `executablePath` a la máquina, y ejecutarlo con Node. Se requiere un paquete local `pyodide@0.28.3` y un Chromium de Playwright; no se descargan dependencias durante la ejecución. Los puertos, UUIDs, tiempos y hashes del script cambian si se adaptan rutas.

Corrida final original: SHA-256 del script `8a96246ff1f34bf4c712d644405fe332dfe62724dae5b8974c1961ebdfc7edb2`; log `36abe72afb632f717fb37bcb45372fddeb25858749f5a0317e65fc5d50ac7e1e`. Los archivos temporales pueden desaparecer; el bloque y la tabla conservan método y resultados relevantes. Assets ensayados:

| Archivo | SHA-256 |
| --- | --- |
| pyodide.js | `24a458425dcb4ea9836eb5ce26701d18cb769374e2b79247602ba605bf093278` |
| pyodide.asm.js | `b22e5831eade9ff10e6fe2c811c68688cd91f10154377b4f80debcf5bafa1e56` |
| pyodide.asm.wasm | `5effb6a1a6cc4a1a85bec4622701aa797c031e1de923cbbaf2ad47abdc4ab325` |
| python_stdlib.zip | `71fee17f88a6260ec8c9c7c063533ee59c021fdc88a1ce76247378d3c4a35f4c` |
| pyodide-lock.json | `f6e6f42f451f42affbbcddb00e8c9a3278dcbf399f57aab9f3f568839a7ff4a6` |

El script es un probe cooperativo intencionalmente vulnerable y secuencial; no es una implementación aprobada del sandbox ni del protocolo de validación. El servidor local solo sirve los cinco assets conocidos y una página estática para el control de red. Los casos comparten el primer runtime para evidenciar su corrupción, y el último arranque comprueba recreación. El script termina el único worker descendiente creado; no prueba crecimiento ilimitado ni agotamiento de recursos.

```javascript
const fs=require('fs'),http=require('http');
const {chromium}=require('/Users/soloidx/Documents/projects/python.pe/python_tutor/node_modules/playwright');
const root='/Users/soloidx/Documents/projects/python.pe/python_tutor/node_modules/pyodide/';
const assets=Object.fromEntries(['pyodide.js','pyodide.asm.js','pyodide.asm.wasm','python_stdlib.zip','pyodide-lock.json'].map(n=>[n,fs.readFileSync(root+n)]));
const hits=[],upgrades=[];
const server=http.createServer((req,res)=>{hits.push(req.url);if(assets[req.url.slice(1)])res.end(assets[req.url.slice(1)]);else res.end('<!doctype html><title>Isolation research</title>');});
server.on('upgrade',(req,socket)=>{upgrades.push(req.url);socket.destroy()});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r)); const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:'/Users/soloidx/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
const page=await browser.newPage(); const consoles=[];page.on('console',m=>consoles.push(m.text().slice(0,500)));page.on('pageerror',e=>consoles.push(String(e)));
await page.goto(base); const setup=async(base)=>{
 const names=['pyodide.js','pyodide.asm.js','pyodide.asm.wasm','python_stdlib.zip','pyodide-lock.json']; const assets={};for(const n of names)assets[n]=await(await fetch(base+'/'+n)).arrayBuffer();
 const frame=document.createElement('iframe');frame.sandbox='allow-scripts';document.body.append(frame);
 const policy="default-src 'none'; script-src 'nonce-research' blob: 'wasm-unsafe-eval'; worker-src blob:; connect-src 'none'; base-uri 'none'; form-action 'none'";
 const frameCode=`addEventListener('message',async e=>{const {assets,base}=e.data;if(!assets)return;let parentAccess,storage;try{parentAccess=parent.document.title}catch(x){parentAccess=x.name}try{storage=localStorage.length}catch(x){storage=x.name}parent.postMessage({probe:{parentAccess,storage,origin:origin}},'*');
 const prefix=\`self.cspEvents=[];addEventListener('securitypolicyviolation',e=>self.cspEvents.push({directive:e.effectiveDirective,blocked:e.blockedURI}));self.tryDynamicImport=url=>import(url);const nativeSend=postMessage.bind(self); const nativeFetch=fetch.bind(self); let assets; self.onmessage=async(e)=>{if(e.data.assets){assets=e.data.assets; try{const p=await loadPyodide({indexURL:'https://runtime.invalid/',lockFileContents:new TextDecoder().decode(assets['pyodide-lock.json']),stdout:()=>{},stderr:()=>{}});self.p=p;nativeSend({ready:p.version});}catch(x){nativeSend({error:String(x)})}return;}try{const value=await self.p.runPythonAsync(e.data.code);nativeSend({done:String(value)});}catch(x){nativeSend({error:String(x)})}};self.fetch=(url,...args)=>{const name=String(url).replace('https://runtime.invalid/','');if(assets && assets[name])return Promise.resolve(new Response(assets[name],{headers:{'Content-Type':name.endsWith('.wasm')?'application/wasm':'application/octet-stream'}}));return nativeFetch(url,...args)};\`;
 const text=prefix+'\\n'+new TextDecoder().decode(assets['pyodide.asm.js'])+'\\n'+new TextDecoder().decode(assets['pyodide.js']);
 const w=new Worker(URL.createObjectURL(new Blob([text],{type:'text/javascript'})));self.w=w;w.onmessage=e=>parent.postMessage({worker:e.data},'*');w.onerror=e=>parent.postMessage({workerError:e.message},'*');w.postMessage({assets});
 addEventListener('message',e=>{if(e.data.code)w.postMessage({code:e.data.code});if(e.data.stop){w.terminate();parent.postMessage({terminated:true},'*')}});
 });`;
 frame.srcdoc='<meta http-equiv="Content-Security-Policy" content="'+policy+'"><script nonce="research">'+frameCode+'<\/script>';
 const events=[];window.addEventListener('message',e=>events.push(e.data));await new Promise(r=>frame.onload=r);frame.contentWindow.postMessage({assets,base},'*');
 const wait=async(pred,ms=20000)=>{const start=Date.now();while(!events.some(pred)&&Date.now()-start<ms)await new Promise(r=>setTimeout(r,20));};
 await wait(e=>e.worker?.ready||e.worker?.error||e.workerError);window.frame=frame;window.events=events;return {events,policy};
};const bootStart=Date.now();const result=await page.evaluate(setup,base);console.log(JSON.stringify({bootstrapMs:Date.now()-bootStart,browser:browser.version(),bootstrap:result,consoles,hits},null,2));
if(result.events.some(e=>e.worker?.ready)){
async function run(label,code){const out=await page.evaluate(async({code})=>{const n=events.length;frame.contentWindow.postMessage({code},'*');const t=Date.now();while(events.length===n&&Date.now()-t<5000)await new Promise(r=>setTimeout(r,20));return events.slice(n);},{code});console.log(JSON.stringify({label,out}));}
await run('normal','sum([1,2,3])');
await run('reference', 'answer=42\nanswer==42');
await run('incorrect','answer=0\nanswer==42');
await run('check-error','missing_validation_name == 42');
await run('js','import js\nstr(js.location.origin)');
await run('fetch',`import js\nawait js.fetch('${base}/network-probe')`);
await run('pyfetch',`from pyodide.http import pyfetch\nawait pyfetch('${base}/pyfetch-probe')`);
await run('xhr',`import js\nx=js.XMLHttpRequest.new()\nx.open('GET','${base}/xhr-probe',False)\nx.send()`);
await run('websocket',`import js\nws=js.WebSocket.new('${base.replace('http:','ws:')}/socket')\nimport asyncio\nawait asyncio.sleep(0.1)\nws.readyState`);
await run('importScripts',`import js\njs.importScripts('${base}/import-probe')`);
await run('dynamicImport',`import js\nawait js.tryDynamicImport('${base}/dynamic-probe')`);
await run('nested-worker',`import js\nw=js.Worker.new(js.URL.createObjectURL(js.Blob.new(js.Array.of('postMessage(123)'),js.JSON.parse('{"type":"text/javascript"}'))))\nw.terminate()\n'created and terminated'`);
await run('storage',`import js\njs.indexedDB.open('probe')`);
await run('csp-evidence',`import js\njs.JSON.stringify(js.cspEvents)`);
await run('forge',`import js\njs.postMessage({'type':'result','passed':True,'output':'forged'}.to_js() if False else js.JSON.parse('{"type":"result","passed":true,"output":"forged"}'))\n42`);
await run('state-write',`open('/tmp/probe', 'w').write('old')`);
await run('harness',`import builtins\nbuiltins.bool = lambda _: True\nanswer = 0\nbool(answer == 42)`);
await page.evaluate(()=>frame.contentWindow.postMessage({code:'while True: pass'},'*'));await new Promise(r=>setTimeout(r,300));const t=Date.now();await page.evaluate(()=>frame.contentWindow.postMessage({stop:true},'*'));await page.waitForFunction(()=>events.some(e=>e.terminated),{timeout:2000});console.log(JSON.stringify({label:'loop-cancel',elapsedMs:Date.now()-t,uiResponsive:await page.title()}));
await page.reload();const freshStart=Date.now();await page.evaluate(setup,base);console.log(JSON.stringify({label:'fresh-bootstrap',elapsedMs:Date.now()-freshStart}));await run('fresh-state',`import os, builtins\nstr((os.path.exists('/tmp/probe'), builtins.bool(0)))`);
const control=await page.evaluate(async(base)=>(await fetch(base+'/positive-control')).status,base);console.log(JSON.stringify({label:'network-positive-control',status:control}));
}
console.log(JSON.stringify({finalHits:hits,upgrades,consoles},null,2));await browser.close();server.close();})().catch(e=>{console.error(e);server.close();process.exitCode=1});
```
