# Evaluación declarativa externa: resultado de investigación y corrección

2026-11-10. Responde a [Investigar evaluación externa con reglas declarativas para cursos personales](https://github.com/soloidx/python-tutor/issues/81). Prototipo corregido: [1d78bc0](https://github.com/soloidx/python-tutor/tree/1d78bc0/src/personal-validation.prototype). Rama de código descartable, sin PR, merge ni integración en producción. Este informe es el único archivo de su rama research.

## Resultado

**Viable como arquitectura del perfil acotado investigado, con evidencia de protocolo, funcionamiento y controles del navegador en Chrome y WebKit.** Se corrigieron los defectos concretos que impedían aceptar la demo: esquema incompleto, estados abiertos, plazos renovables, cancelación sin acuse y canal público de resultados. La decisión de planificación puede usar esta arquitectura; no se afirma seguridad universal ni se autoriza activar el feature en un despliegue que no cumpla sus condiciones.

El veredicto pertenece a la aplicación. El programa produce estado/salida, no una aprobación aceptada por el supervisor. Que un programa termine con el valor esperado satisface una regla de valor: no demuestra que haya utilizado el algoritmo deseado. Esa limitación pedagógica se trata con revisión y casos variados, sin convertirla en una garantía imposible de anticopia.

## Perfil y modelo de confianza

- Solo igualdad de salida y escalares tipados: texto, booleanos y números finitos con magnitud ≤ 2^53−1. Todas las reglas deben cumplirse; stdout conserva la normalización `trimEnd()` aprobada en el prototipo.
- No se ejecutan expresiones Python/JS como reglas. Listas, objetos, proxies, funciones, None e enteros fuera de rango no forman parte del perfil. Cursos personales que requieran otras comprobaciones deben adaptarse o rechazarse; no hay fallback al check arbitrario. Los cursos originales conservan su contrato.
- Se confía en el navegador, los scripts supervisores y los binarios fijados del runtime. No se cargan extensiones ni paquetes proporcionados por el contenido. No se afirma resistencia a un navegador/runtime comprometido, depurador del propietario, modificación de assets confiables o corrupción nativa del motor.
- La aplicación no entrega credenciales, progreso, conversaciones, reglas esperadas, funciones RPC ni archivos del estudiante al worker. El origen ejecutor se dedica a assets públicos y no contiene datos de la aplicación.

## Por qué el canal cambió la autoridad

El supervisor crea un MessageChannel por sesión y transfiere un puerto durante el bootstrap confiable. El adaptador del worker conserva ese puerto y su emisor ligado dentro de un cierre JS; no lo registra en Python ni en `jsglobals`. Después de bootstrap retira el receptor público del worker. El supervisor no instala `worker.onmessage` para resultados: solo recibe por el puerto privado asociado al run.

La recepción exige versión, campos exactos, tipos, longitudes y fase. Un `ready` solo se acepta durante carga; solo entonces se arma una vez el plazo de ejecución y se envía una vez el programa. Terminales prematuros, duplicados, desconocidos o fuera de esquema no cambian la sesión ni su reloj. Una ejecución cerrada destruye worker y puerto antes de reenviar el terminal. Cancelar aborta la precarga pendiente y la UI espera el acuse, con watchdog de recuperación.

Los puertos como capacidades son un mecanismo del [estándar HTML](https://html.spec.whatwg.org/multipage/web-messaging.html#ports-as-the-basis-of-an-object-capability-model-on-the-web). La privacidad de las referencias se apoya en el [modelo de entornos léxicos de ECMAScript](https://tc39.es/ecma262/multipage/executable-code-and-execution-contexts.html#sec-lexical-environments), no en ocultar un nonce dentro de un mensaje público. Esto razona la frontera del adaptador; no pretende ser una prueba formal de todo Pyodide.

## Captura y corrección

El diccionario de la ejecución y su método `get` se obtienen antes del código. La captura limita valores mediante `typeof` y funciones numéricas originales; no llama a `bool(check)`, no convierte objetos arbitrarios con `toJs`/repr y no acepta campos de aprobación. El comparador y las reglas están en el contexto de la aplicación, separados de los builtins y globales del programa.

Se inspeccionó además el getter de PyProxy del artefacto fijado: usa la referencia léxica `__pyproxy_getitem`, inicializada desde los exports WASM, y la captura retiene el método antes de la ejecución. No se supone que volver a buscar un getter/builtin mutable después de ejecutar sea equivalente. El artefacto JS coincide con SHA-256 `b22e5831eade9ff10e6fe2c811c68688cd91f10154377b4f80debcf5bafa1e56`. Las [conversiones oficiales de Pyodide 0.28.3](https://pyodide.org/en/0.28.3/usage/type-conversions.html) distinguen valores primitivos de proxies; el perfil rechaza lo que no sea un escalar admitido.

Esta captura es evidencia del diseño bajo el runtime confiable fijado, no una certificación contra cualquier alteración interna del intérprete. La revisión completa del puente y una suite adversarial exhaustiva no se realizaron; no se reproducen las pruebas bloqueadas previamente. Esa exclusión se conserva explícita y no se convierte en un pase ficticio.

## Separación de permisos y bootstrap

Dos orígenes HTTP locales simulan aplicación y ejecutor. El supervisor carga tres assets públicos; el servidor incluye los scripts originales y el adaptador en el worker URL. El adaptador sirve únicamente bytes ya recibidos mediante su fetch de memoria y no delega peticiones desconocidas. La versión devuelta debe ser 0.28.3. No se modifica el paquete Pyodide.

La respuesta del propio worker tiene `default-src 'none'; script-src 'wasm-unsafe-eval'; connect-src 'none'; worker-src 'none'; base-uri 'none'`. La del supervisor permite cargar sus assets y crear ese worker. Una fixture de conformidad usa exactamente la misma constante de cabecera y comprueba conexión y creación de un worker benigno: ambos quedaron denegados con sus eventos CSP. Se espera el error asíncrono de creación; que el constructor devuelva un objeto no cuenta como éxito.

La necesidad de [CSP propia en workers URL](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers#content_security_policy), [connect-src](https://www.w3.org/TR/CSP3/#directive-connect-src) y [worker-src](https://www.w3.org/TR/CSP3/#directive-worker-src) está documentada. CSP no reemplaza el modelo de origen, la validación de mensajes ni una cuota de RAM.

## Pruebas y reproducción

En la rama del prototipo, con assets preparados y servidor en ejecución:

```sh
python3 src/personal-validation.prototype/serve.py
node src/personal-validation.prototype/verify-protocol.cjs
PROTOTYPE_ENGINES=Chrome,WebKit node src/personal-validation.prototype/verify-browser.cjs
```

Los scripts no requieren claves ni estado del usuario. El primero encuentra assets en el checkout principal; las comprobaciones de navegador encuentran Playwright allí. `PROTOTYPE_URL` permite otro puerto y `PROTOTYPE_RESULTS` guarda resultados. Firefox puede seleccionarse cuando su instalación funcione.

**Regresión:** los cinco síntomas iniciales fueron rojos antes de modificar el código (tipo de nombre, mensaje desconocido, cancelación optimista, ready duplicado, ausencia de puerto privado). La versión corregida pasó **12 comprobaciones** de handlers reales: añade terminal fuera de fase, execute duplicado, error malformado, acuse, aborto de precarga, observaciones tipadas/cerradas y ausencia de receptor público. Se usan fixtures de componentes, no mensajes de manipulación desde Python.

| Motor | Origen/storage | Conexión y worker secundario con CSP | Correcto/incorrecto/error/perfil/límites | Cancelación y recuperación | Plazo y recuperación |
| --- | --- | --- | --- | --- | --- |
| Chrome 157.0.8103.39 | Pasa | Denegados; eventos connect-src y worker-src | Pasa | Pasa, con acuse | ~10.003 s, pasa |
| WebKit 27.2 | Pasa | Denegados; eventos connect-src y worker-src | Pasa | Pasa, con acuse | ~9.992 s, pasa |

Contextos headless independientes en macOS ARM64, sin sesión del usuario. No hubo errores de página observados. El plazo se comprobó con espera asíncrona ordinaria de 12 s, sin presión intensiva de CPU/memoria. Los recorridos incluyeron sintaxis inválida, lista no admitida, salida excesiva y regla fuera de esquema. Las pruebas previas de assets ausentes y recuperación quedan documentadas en el [informe de verificación anterior](https://github.com/soloidx/python-tutor/blob/9dfc13d/docs/research/personal-content-validation-verification.md).

Firefox 159.0 fue descargado, pero falló antes de abrir la demo («Could not find profile folder»), incluso usando otro directorio temporal y un perfil persistente nuevo. No se reporta como navegador probado ni soportado por estos resultados. No se usó el perfil del usuario.

## Límites y condiciones que debe conservar la implementación

1. **Hosting real:** demostrar las mismas cabeceras, origen dedicado sin credenciales/cookies compartidas y bootstrap cerrado en el alojamiento elegido. Los puertos locales no prueban por sí solos esa configuración ni aislamiento de cookies. No se ha desplegado ni contratado nada.
2. **Compatibilidad:** habilitar solo tras comprobar el contrato de capacidades en motores admitidos. Un fallo de carga/política no debe degradar al worker del origen de la app ni permitir incorporar contenido sin validar. Firefox y dispositivos reales siguen pendientes de verificación de despliegue.
3. **Recursos:** diez segundos de ejecución, 45 de carga, 20.000 unidades de cadena por canal, código de 16.000 unidades, hasta veinte nombres/reglas y 64 MiB por asset aceptado. Son cotas del protocolo/aceptación, no cuotas duras de RAM total ni inmunidad a disponibilidad del navegador. Las cadenas y ArrayBuffers pueden existir antes de su comprobación. No se ensayó agotamiento.
4. **Dependencias:** fijar/verificar runtime y assets; cambios del motor, adaptador, bridge o políticas requieren repetir la revisión. `jsglobals: {}` por sí solo no es una certificación de sandbox según la [API 0.28.3](https://pyodide.org/en/0.28.3/usage/api/js-api.html#loadPyodide).
5. **Pedagogía e incorporación:** las reglas también son contenido generado y se revisan; las muestras finitas no garantizan todas las soluciones posibles. El perfil debe corregir del mismo modo en Aprender y Práctica. Se mantienen las dos aprobaciones y la incorporación atómica de contenido completo.

## Alcance de la conclusión para el mapa

Esta investigación ya permite elegir una arquitectura concreta para el perfil personal aceptado y aporta controles y evidencia reproducibles, en lugar de dejar un «canal externo» indefinido. La resolución de investigación no equivale a certificar producción ni exime de verificar hosting/compatibilidad antes de activar el feature. Si se pide una garantía adversarial más fuerte que este modelo y evidencia, debe decidirse y comprobarse por separado; no está implícita en los casos funcionales ni en la palabra «privado».
