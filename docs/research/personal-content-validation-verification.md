# Comprobación del ejecutor separado y del canal de resultados

2026-11-10. Solicitud del usuario: «ok compruebalo». Objeto: [prototipo 06005deadf80e13f914d88cc930d86a24db487cb](https://github.com/soloidx/python-tutor/tree/06005deadf80e13f914d88cc930d86a24db487cb/src/personal-validation.prototype), no aplicación de producción. Complementa [Investigar evaluación externa con reglas declarativas para cursos personales](https://github.com/soloidx/python-tutor/issues/81).

## Veredicto

**La separación básica y la recuperación funcional pasan las comprobaciones ejecutadas; no se aprueba la integridad completa del canal ni el aislamiento integral.** Hay defectos concretos del protocolo y obligaciones de comprobación pendientes. La aprobación humana del prototipo funcional no se revoca; responde a otra pregunta.

No se modificó el prototipo ni el producto. La revisión fue estática y documental, más comprobaciones funcionales benignas en un navegador nuevo y sin datos reales. No se repitió la prueba rechazada previamente ni se intentó eludir la revisión automática.

## Evidencia ejecutada

Playwright controló una instancia independiente de Google Chrome **157.0.8103.39**, headless, macOS ARM64. Los sitios fueron `http://127.0.0.1:8871` y `http://127.0.0.1:8872`; el servidor existente sirvió el commit indicado. Se usaron contextos temporales, sin sesión del usuario.

| Comprobación | Resultado observado | Alcance |
| --- | --- | --- |
| Página intenta leer el documento del iframe | `SecurityError` | Separación DOM entre estos dos orígenes |
| Iframe intenta leer documento del padre | `SecurityError` | Separación DOM en sentido inverso |
| Marca sintética guardada en localStorage de la página | El localStorage del ejecutor devolvió `null` | Almacenamiento de estos orígenes separado; no se leyó almacenamiento real del estudiante |
| GET del script worker | Cabecera `default-src 'none'; script-src 'wasm-unsafe-eval'; connect-src 'none'; worker-src 'none'; base-uri 'none'` | Cabecera servida; no demuestra por sí sola cobertura efectiva de todas las capacidades |
| Programa ordinario espera asíncronamente 12 s | «Tiempo excedido» a aproximadamente **10.017 s** desde fase de ejecución | Plazo externo funcionó en esta corrida sin consumo intensivo de CPU |
| Esperar otros 2,3 s después del plazo | Permaneció «Tiempo excedido» | No se aceptó después el resultado ordinario vencido |
| Ejecutar el caso correcto después | «Aprobado» | Recuperación tras terminación |
| Asset público stdlib responde 404 mediante fixture de red de Playwright | «Error de carga» | No aprobó contenido sin runtime |
| Retirar el fixture y volver a ejecutar | «Aprobado» | Recuperación de fallo de precarga |

No hubo errores de página observados en el contexto principal de estas comprobaciones. El 404 fue un fallo controlado en otro contexto, no una interrupción del servidor real. Los resultados detallados quedaron en `/tmp/python-tutor-isolation-functional-check.json`; este informe conserva el método y sus resultados, porque los archivos temporales no son activos duraderos.

No se probaron Firefox, WebKit, hosting público, cuotas de memoria, agotamiento de recursos, ni ataques de manipulación del intérprete o mensajes. No se afirma certificación general de seguridad. La separación observada concuerda con el [modelo de orígenes HTML](https://html.spec.whatwg.org/multipage/browsers.html#origin); el uso de puertos distintos no separa cookies como si fueran dominios distintos.

## Defectos constatados por inspección

Estos son comportamientos del código, no pruebas de que Python pueda explotarlos.

1. **Falta exigir texto en nombres de variable.** [`index.html:31`](https://github.com/soloidx/python-tutor/blob/06005deadf80e13f914d88cc930d86a24db487cb/src/personal-validation.prototype/index.html#L31) y [`executor.html:29`](https://github.com/soloidx/python-tutor/blob/06005deadf80e13f914d88cc930d86a24db487cb/src/personal-validation.prototype/executor.html#L29) aplican regex sin comprobar `typeof name`. La operación convierte a texto antes de comparar; puede aceptar datos fuera del esquema conceptual. Exigir tipo antes del patrón. [ECMAScript: RegExp.test](https://tc39.es/ecma262/multipage/text-processing.html#sec-regexp.prototype.test).
2. **No hay máquina de estados de protocolo.** [`executor.html:42`](https://github.com/soloidx/python-tutor/blob/06005deadf80e13f914d88cc930d86a24db487cb/src/personal-validation.prototype/executor.html#L42) procesa cada `ready` mientras el run existe: rearma el temporizador y vuelve a enviar la ejecución. Falta aceptar ready solo una vez en carga y terminales solo en su fase. Que el worker ordinario no repita mensajes no sustituye esa validación.
3. **Mensaje desconocido consume la sesión de la página.** [`index.html:85`](https://github.com/soloidx/python-tutor/blob/06005deadf80e13f914d88cc930d86a24db487cb/src/personal-validation.prototype/index.html#L85) borra `active` antes de comprobar si el mensaje es un terminal válido. Validar variante y fase antes de mutar; un error de canal debe cancelar de forma explícita, no dejar estados ambiguos.
4. **Esquemas y límites incompletos en variantes distintas de observaciones.** [`executor.html:40`](https://github.com/soloidx/python-tutor/blob/06005deadf80e13f914d88cc930d86a24db487cb/src/personal-validation.prototype/executor.html#L40) solo exige tipo string antes de reenviar terminales. La página limita algunas cadenas, pero no aplica un esquema cerrado uniforme a versión, mensajes y salida de error. Reenviar solo campos reconocidos y acotados. Se usa `textContent`, por lo que no se afirma que esos datos se ejecuten como HTML.
5. **La UI confirma cancelación antes del acuse.** [`index.html:71`](https://github.com/soloidx/python-tutor/blob/06005deadf80e13f914d88cc930d86a24db487cb/src/personal-validation.prototype/index.html#L71) muestra Cancelado y elimina active inmediatamente, ignorando luego el acuse del supervisor. Distinguir Cancelando de Cancelado confirmado. Además, terminar el run no aborta la precarga compartida de assets: decidir caché deliberada frente a AbortController.

La especificación HTML exige comprobar el origen y el formato esperado de los mensajes. El prototipo ya comprueba origen, ventana e identidad de ejecución; faltan las restricciones anteriores de fase y variantes. [HTML: seguridad de postMessage](https://html.spec.whatwg.org/multipage/web-messaging.html#security-postmsg).

## Frontera que todavía no está acreditada

- El evaluador de reglas es externo, pero la fuente de observaciones sigue siendo el runtime que ejecuta la solución. Verificar el tipo de un dato recibido no autentica cómo se obtuvo. Hay que definir la autoridad de esa captura y del canal antes de afirmar integridad.
- `jsglobals: {}` modifica lo visible por el módulo js. La [API Pyodide 0.28.3](https://pyodide.org/en/0.28.3/usage/api/js-api.html#loadPyodide) documenta configuración, no una garantía completa de confinamiento; no se convierte aquí en certificación.
- La CSP propia del worker es la ubicación correcta para su política. Los [workers URL tienen su propio contexto CSP](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers#content_security_policy). La cabecera observada y el arranque normal no prueban todos los accesos posibles ni todas las implementaciones de navegador.
- Salidas de 20.000 unidades JS y temporizador no equivalen a una cuota dura total de RAM ni a inmunidad a presión del navegador. Esa limitación ya consta en el prototipo.

## Siguiente trabajo concreto

Corregir el esquema y las transiciones, definir cancelación confirmada y validar todas las variantes; después verificar conformidad del protocolo con fixtures inocuos de mensajes y fallos. Documentar por separado la obtención confiable de observaciones y revisar la frontera real del runtime. Contrastar las políticas en el hosting elegido y motores soportados. Mantener la ejecución automática deshabilitada hasta cumplir esos criterios; no volver a pedir aprobación del comportamiento visual que ya fue aceptado.

Este resultado justifica mantener abierta la investigación y la decisión de orquestación. No sustituye un hallazgo concreto por un bloqueo genérico: enumera qué pasó, qué falla por código y qué todavía no se comprobó.
