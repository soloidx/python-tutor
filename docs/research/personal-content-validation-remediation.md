# Ruta para resolver las observaciones de validación personal

Investigación documental, 2026-11-10, para [Investigar evaluación externa con reglas declarativas para cursos personales](https://github.com/soloidx/python-tutor/issues/81). No implementa el generador, no adopta una arquitectura y no reproduce la prueba bloqueada por revisión automática. Base del consumidor: `4b640b0`; runtime fijado: Pyodide 0.28.3.

## Conclusión

Existe una ruta concreta de diseño para separar permisos y evaluación: ejecutor en un origen web dedicado sin datos del estudiante, worker con política CSP propia, assets públicos precargados y evaluador de reglas declarativas fuera del intérprete. Las piezas tienen soporte documental, pero la integración completa y la autoridad del canal no están demostradas. No se pueden dar por levantadas las observaciones solo con este informe.

La restricción de la herramienta y las observaciones del producto son asuntos distintos. El rechazo automático no prueba una vulnerabilidad ni imposibilidad de implementación. Este trabajo continúa mediante documentación y criterios funcionales, sin intentar eludir esa revisión.

## 1. Separar el ejecutor de los datos de la aplicación

**Propuesta:** un sitio estático de ejecución en un origen distinto del de la aplicación; no alojar allí claves, progreso, historial ni archivos del estudiante. Un iframe de ese sitio puede alojar su propio worker. La aplicación solo entrega el código y assets públicos indispensables, mediante un protocolo cerrado, sin funciones RPC con acceso a su almacenamiento.

La política del mismo origen separa accesos entre documentos de distintos orígenes; un iframe opaco también puede servir para separar datos, pero su carga de workers y recursos exige una integración específica. No presentar un iframe de origen opaco y un worker URL de otro origen como una combinación automáticamente válida. [HTML: sandbox](https://html.spec.whatwg.org/multipage/iframe-embed-object.html#attr-iframe-sandbox), [orígenes](https://html.spec.whatwg.org/multipage/browsers.html#origin).

Un origen dedicado sigue requiriendo decisiones de alojamiento, dominio, permisos y restricciones de carga. Es infraestructura estática adicional, no un backend de ejecución ni un cambio al catálogo remoto. No está aprobada su contratación o despliegue.

## 2. Aplicar la política al worker, no solo a la página

Los workers URL reciben su CSP de la respuesta de su script; en general no quedan gobernados por la CSP de su creador. Los workers blob heredan la del creador. Esto permite estudiar un supervisor que pueda crear su worker, mientras el worker URL tenga una política propia que no permita crear otros workers. Esa diferenciación evita depender exclusivamente de una política blob compartida. [MDN: CSP de workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers#content_security_policy).

**Requisitos propuestos:** prohibir conexiones durante la ejecución; restringir scripts y otras fuentes; no conceder capacidades innecesarias. `connect-src` y `worker-src` tienen responsabilidades diferentes; se debe verificar la política efectiva del documento y del worker. La especificación CSP3 es un borrador, no evidencia de comportamiento idéntico de todos los motores. [W3C: connect-src](https://www.w3.org/TR/CSP3/#directive-connect-src), [worker-src](https://www.w3.org/TR/CSP3/#directive-worker-src).

El alojamiento debe poder emitir cabeceras por recurso. Por ejemplo, Cloudflare Pages documenta `_headers` para respuestas estáticas; esto acredita la existencia de una opción de alojamiento, no una recomendación de migrar ni una configuración ya desplegada. No asumir que el alojamiento actual permite lo mismo. [Documentación oficial de cabeceras](https://developers.cloudflare.com/pages/configuration/headers/).

## 3. Resolver la carga de Python sin abrir la red al código generado

Pyodide necesita sus assets y biblioteca estándar. Su API documenta `indexURL`, `lockFileContents` y `stdLibURL`, entre otras opciones; no equivale a una API pública que garantice inyectar todos los bytes sin integración adicional. La investigación previa obtuvo una prueba mínima de assets desde memoria en Chromium, pero no una solución completa de producto. [API 0.28.3](https://pyodide.org/en/0.28.3/usage/api/js-api.html#loadPyodide), [informe previo](https://github.com/soloidx/python-tutor/blob/c755433/docs/research/generated-content-isolation.md).

**Condición para resolver esta observación:** carga de assets por componentes confiables antes de ejecutar contenido personal; ninguna excepción de red disponible al código Python generado. Permitir descargas indefinidamente y llamar al entorno «sin red» sería incorrecto. Si no puede integrarse en el hosting elegido, debe revisarse el alojamiento o el runtime, sin cambiar silenciosamente el requisito.

## 4. Sustituir comprobaciones ejecutables por reglas de datos acotadas

**Perfil candidato, no adoptado:** igualdad exacta de stdout; igualdad tipada de variables escalares (texto, booleanos y números finitos dentro del rango acordado); conjunción de reglas. Validar el esquema y rechazar operaciones/tipos desconocidos. Excluir inicialmente expresiones Python/JavaScript arbitrarias, funciones, clases, proxies y conversiones genéricas. Listas, diccionarios y tolerancias numéricas requieren especificación posterior, no aceptación implícita.

La captura de salida tiene APIs documentadas. Las conversiones de Pyodide distinguen valores convertidos y objetos proxy; no debe suponerse que convertir cualquier objeto produce datos inertes. [Streams 0.28.3](https://pyodide.org/en/0.28.3/usage/streams.html), [conversiones de tipos](https://pyodide.org/en/0.28.3/usage/type-conversions.html).

El evaluador confiable conserva las reglas esperadas y calcula el veredicto. El mensaje recibido no tiene autoridad para aprobar un ejercicio. No usar `eval` ni ejecutar las reglas como código. El dato observado debe obtenerse por un canal definido y no delegar autoridad de aprobación al programa evaluado.

Esta propuesta limita ejercicios personales y requiere aceptación humana. Los originales mantienen su contrato actual; el adaptador personal debe distinguir explícitamente ambos formatos. El mismo perfil deberá servir para validar referencias y para corregir al estudiante en Aprender y Práctica: no generar ejercicios que luego solo puedan validarse con el antiguo check arbitrario.

## 5. Distinguir un resultado correcto de una prueba falsa

Un programa que produce la salida esperada satisface una regla de salida; eso no constituye por sí mismo falsificación. La limitación pedagógica se aborda con variedad de casos y revisión, sin prometer detectar todas las estrategias posibles.

Es distinto aceptar un mensaje de aprobación sin comprobar las observaciones. El esquema de mensajes, una instancia de ejecución, identificadores de contenido/caso y validación de emisor reducen confusiones, pero un nonce o un puerto no certifica por sí solo la autenticidad de lo observado. La obtención de datos y su canal siguen siendo una obligación de diseño que aquí no se demuestra. [HTML: seguridad de mensajes](https://html.spec.whatwg.org/multipage/web-messaging.html#security-postmsg).

## 6. Límites y fallos explícitos

Mantener el reloj en un supervisor independiente, diez segundos por caso y terminación completa ante cancelación/timeout; recrear el runtime para cada caso. Aplicar el límite acordado de salida como error y no como truncamiento silencioso. Aceptar solo mensajes pequeños con esquema cerrado; salida, errores y metadatos no son HTML ejecutable. Distinguir aprobado, rechazado, error y límite excedido. [HTML: workers y terminación](https://html.spec.whatwg.org/multipage/workers.html#dom-worker-terminate).

No existe en este informe evidencia de una cuota dura total de RAM de pestaña o worker. Los límites de WebAssembly.Memory no equivalen a límites de todas las asignaciones JavaScript del proceso. Debe documentarse el riesgo residual de disponibilidad, no ofrecer inmunidad absoluta. [WebAssembly: memorias](https://webassembly.github.io/spec/js-api/index.html#memories).

## Criterios para resolver, no solo documentar

| Observación | Entregable necesario | Estado actual |
| --- | --- | --- |
| Acceso a datos/permisos | Origen dedicado o compartimento equivalente, protocolo sin datos sensibles y políticas efectivas | Diseño documentado; integración nueva no probada |
| Red/carga del runtime | Arranque con assets controlados y política de ejecución sin conexiones | Prueba previa parcial; nuevo despliegue pendiente |
| Aprobación controlada por el programa | Esquema de reglas y canal de observaciones con autoridad externa definida | Propuesta, no demostrado |
| Tiempo, salida y estado | Supervisor, límites y runtime nuevo por caso | Requisitos; verificación de integración pendiente |
| Compatibilidad | Resultados en navegadores y hosting admitidos, con fallos cerrados | Pendiente |
| Alcance pedagógico | Aprobación del perfil limitado y corrección coherente en Aprender/Práctica | Decisión humana pendiente |

El siguiente experimento puede limitarse a conformidad funcional en un entorno descartable sin datos reales: resultado correcto, incorrecto, error ordinario, tipo no admitido, exceso de salida, cancelación y mensajes de una ejecución vencida. No precisa reproducir la prueba bloqueada. Esa conformidad no sustituye la revisión independiente de la frontera y del canal.

**Recomendación:** elegir primero el perfil limitado y la viabilidad del alojamiento con cabeceras; después contrastar el prototipo funcional y revisar su arquitectura. Si se requiere una garantía más fuerte que el perfil navegador pueda sostener, reabrir explícitamente runtime/infraestructura con el usuario. No declarar resuelta la observación por documentación, por quitar `import js` o por otra llamada al LLM.
