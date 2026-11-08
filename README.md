# Python Tutor

Una aplicación estática en español para aprender Python sin instalarlo ni crear una cuenta.

## Desarrollo

Requiere Node.js 20.19+ o 22.12+.

```sh
npm ci
npm run dev
```

`npm ci` copia el intérprete Pyodide fijado en el lockfile a `public/runtime/`. El sitio sirve esos archivos localmente; ejecutar Python no depende de un CDN ni de un backend. La primera carga descarga aproximadamente 13 MB de intérprete y biblioteca estándar desde el propio sitio. Las fuentes web son opcionales: la interfaz conserva fuentes del sistema como alternativa.

```sh
npm test       # recorrido real en navegador con Playwright y Google Chrome
npm run build # salida estática en dist/
npm run preview
```

Instala Google Chrome, o cambia `channel` en `playwright.config.js` y usa `npx playwright install chromium` para usar el Chromium de Playwright. Publica el contenido completo de `dist/` en un servidor estático que sirva WebAssembly con el tipo `application/wasm`. No hay rutas del servidor que configurar; también admite subdirectorios.

## Extender las lecciones

- El navegador conserva la última publicación completa y válida del catálogo para usarla inmediatamente. Busca novedades en segundo plano y las activa solo al recargar; el contenido permanece fijo durante la sesión.
- El contenido procede de una única fuente JSON remota predeterminada. El [contrato de catálogo](docs/catalog.md) describe la URL, los campos, las identidades, las huellas SHA-256 y la publicación de archivos inmutables. No hay cursos integrados de respaldo ni selector de fuente. Publicar y operar la fuente real es externo a la aplicación.
- `src/catalog.js`: descarga y validación completa de cada publicación; `src/CatalogBootstrap.jsx`: carga inicial, errores y Reintentar.
- `tests/fixtures/catalog.js`: fuente HTTP controlada para las pruebas; las lecciones antiguas viven únicamente en `tests/fixtures/content/`.
- `src/assessment.js`: cálculo del resultado de la evaluación opcional del curso remoto mediante IDs de pregunta y opción.
- `src/App.jsx`: rutas → cursos → temas → aprendizaje, con navegación Atrás, contexto visible y acceso libre a cualquier tema.
- `src/progress.js`: lectura validada y escritura del progreso en el almacenamiento local del navegador.
- `src/learnerReset.js`: reinicio del progreso, conversaciones y copias de recuperación por curso o de forma global.
- `src/usePython.js`: estados de carga, ejecución y recuperación del intérprete.
- `public/python-worker.js`: Pyodide en un Web Worker, con un diccionario Python nuevo para cada ejecución. No es un servidor ni un entorno para ejecutar código de otras personas.
- `tests/learning.spec.js`: un recorrido completo mediante la interfaz real y Pyodide, con recarga, reapertura y reinicio del progreso.

Un error o un resultado incorrecto no borra los ejercicios ya completados. Los borradores de código y las pistas se reinician al cambiar de ejercicio. La ejecución tiene un límite de 10 segundos; reiniciar Python termina el Worker y crea un intérprete nuevo.

## Progreso en este navegador

Cada curso conserva sus aprobaciones de ejercicios, última posición y resultado enviado de evaluación final. El avance usa solo los ejercicios vigentes; conserva identidades retiradas para recuperar sus aprobaciones si reaparecen. Un curso compartido por varias rutas tiene el mismo progreso, posición y Conversaciones de tema en todas ellas. Esta es la primera versión oficial: no importa progreso, evaluaciones ni conversaciones del formato anterior.

Cada recarga abre todas las rutas. «Comenzar», «Continuar» o «Repasar» abre el curso en su última posición; si el tema fue retirado, ofrece un destino vigente con un aviso. Los borradores de código, la salida de la consola, las pistas y las respuestas de una evaluación sin enviar no se guardan. El aprendizaje es local a este navegador y origen, sin sincronización entre dispositivos.

«Reiniciar este curso» pide confirmación y borra el aprendizaje del curso abierto en todas sus rutas: aprobaciones (incluidas las retiradas), evaluación final, conversaciones (preguntas, respuestas, parciales y capturas), posición y copias de recuperación. Vuelve a temas y la siguiente entrada ofrece «Comenzar». «Reiniciar todo el aprendizaje» aplica el mismo borrado a todos los cursos, incluidos los retirados del catálogo. Ambos conservan la Configuración del tutor, incluido su acceso temporal o persistente, y el catálogo descargado.

Cancelar conserva los datos y la respuesta activa. Confirmar cancela la generación afectada e invalida eventos tardíos sin reenviar solicitudes. Si el navegador impide borrar o sobrescribir datos, el aviso explica que podrían reaparecer al recargar. Si hay datos parcialmente dañados, se recuperan los registros válidos, se conserva una copia de lo no interpretable y se avisa; si no se puede guardar la copia, se protege el original y se comunica el fallo. Un reinicio explícito incluye esas copias. Borrar los datos del sitio desde el navegador elimina también configuración y catálogo.

## Configuración del tutor

En Aprender, las pestañas Lección y Tutor comparten el espacio izquierdo; el editor y la consola siguen disponibles y conservan su estado al alternarlas o abrir Configuración. En pantallas estrechas se apilan. Las pestañas admiten flechas, Inicio y Fin. El diálogo admite navegación por teclado, Escape y retorno del foco; guardar abre y enfoca Tutor.

Configuración se abre desde la navegación general, el encabezado de Tutor o «Configurar tutor». OpenRouter es el único proveedor habilitado; OpenAI, Anthropic y modelos locales se muestran deshabilitados. La lectura y la ejecución de Python no requieren configurar el tutor.

Introduce tu propia clave en ejecución y pulsa «Validar clave». Se consulta [`GET /key`](https://openrouter.ai/docs/api-reference/limits) y el [catálogo filtrado por cuenta](https://openrouter.ai/docs/api/api-reference/models/list-models-filtered-by-user-provider-preferences-privacy-settings-and-guardrails), con alternativa al catálogo público únicamente si el endpoint filtrado no está disponible. Estas comprobaciones no generan respuestas ni verifican saldo o disponibilidad de generación. Un rechazo solicita corregir la clave; los problemas de conexión o servicio permiten reintentar.

Busca y selecciona un modelo explícitamente: no existe selección predeterminada ni sustitución automática. Solo son elegibles modelos con entrada/salida de texto, ventana de contexto conocida y soporte declarado de límite de salida. Los demás muestran el motivo. La ausencia del máximo de salida no impide elegir un modelo; sus metadatos completos se conservan para calcular el presupuesto de conversación posteriormente.

Los campos son cambios pendientes. «Guardar y volver al tutor» vuelve a comprobar clave y modelo antes de reemplazar la configuración. Cancelar o fallar conserva la anterior. La clave y los metadatos del modelo se guardan en `localStorage`, separados del progreso, y se recuperan tras recargar con «Comprobando acceso…» antes de habilitar el envío. Si el modelo desaparece o deja de ser compatible, hay que seleccionar otro; si falla la red, se conserva lo guardado y se ofrece reintentar. Reiniciar el progreso conserva esta configuración.

La clave se guarda sin cifrar en este navegador y origen; evita un dispositivo compartido. No se incluye en el bundle ni se configura mediante variables de compilación. Si falla la escritura local, la aplicación no afirma que haya guardado: ofrece «Usar solo en esta sesión» mediante una elección explícita y avisa de su pérdida al recargar. Borrar los datos del sitio elimina también este acceso. El envío se habilita únicamente con acceso comprobado.

Durante una respuesta, editar campos, cancelar el diálogo o fallar la validación no interrumpe el acceso anterior. Solo guardar cambios comprobados —o elegir explícitamente el uso temporal tras un fallo de escritura— cancela la solicitud activa y aplica el nuevo acceso; conserva la pregunta, la Captura de contexto y el parcial como incompleto. No hay reenvío automático. Una configuración temporal puede dejar una configuración anterior guardada, que se recuperará tras recargar.

«Eliminar clave» pide confirmación, interrumpe la respuesta y bloquea nuevos envíos; conserva el modelo seleccionado, las conversaciones y el progreso. Cancelar la confirmación no cambia nada. Si el navegador impide retirar la clave guardada, se bloquea el acceso en memoria y se advierte que la clave anterior podría volver tras recargar. Configuración permite volver a intentar eliminarla; borrar los datos del sitio desde el navegador también la retira, junto con los demás datos locales.

`tests/tutor-settings-stream.spec.js` verifica cambios pendientes, cancelados, fallidos y válidos durante SSE, elección temporal explícita, eliminación confirmada/cancelada, fallos de almacenamiento, eventos tardíos, acceso nuevo y conservación del modelo e historial tras recargar. Incluye una pantalla estrecha y usa únicamente credenciales ficticias y HTTP/SSE simulado con LangChain real.

`tests/tutor-access.spec.js` prueba la interfaz real y la persistencia con credenciales ficticias, simulando solo el HTTP de OpenRouter y los fallos de almacenamiento del navegador. Inspecciona las solicitudes para asegurar que validar/guardar/recargar no genera respuestas. La suite conserva el recorrido de aprendizaje con Pyodide real y no requiere inferencias pagadas. Para ejecutar otra copia en paralelo, usa `PLAYWRIGHT_PORT=4185 npm test`.

## Tutor contextual

Envía una pregunta desde Tutor con Enter; Mayús+Enter añade una línea. La respuesta aparece por partes. «Detener» cancela el transporte y conserva el parcial identificado como incompleto. Salir del tema también cancela; volver no reenvía. Cambiar de ejercicio dentro del mismo tema permite seguir la respuesta, que conserva el nombre del ejercicio original. Guardar una configuración válida interrumpe la generación anterior. El texto y los bloques de código se muestran como contenido; «Copiar código» copia al portapapeles y el estudiante decide cómo editar y ejecutar.

Cada envío fija una Captura de contexto: identificación del curso y contenido visible del tema, enunciado, borrador y último resultado de ese ejercicio. Si el borrador cambió, el resultado se marca anterior y lleva el código que lo produjo. Los cambios posteriores de código o ejecución se incorporan al siguiente envío. No se envían comprobaciones internas ni soluciones de las pistas. Cada Conversación de tema se guarda en `localStorage` con sus preguntas, respuestas, identificaciones de ejercicio y capturas originales. Los ejercicios y las rutas del mismo curso y tema comparten el hilo; temas de cursos distintos mantienen conversaciones independientes aunque coincidan sus IDs locales. Guardar una captura no restaura el borrador ni el resultado en el espacio de práctica. Se conservan hasta 50 intercambios por tema, incluidos los incompletos; al crear el 51 se elimina el más antiguo con aviso. Durante streaming se guarda cada parcial recibido; tras recargar, una respuesta en curso aparece interrumpida, sin reanudarse ni reenviarse. Si falla el almacenamiento, se permite continuar temporalmente con un aviso de pérdida al recargar, independiente de la opción explícita de configuración temporal.

«Borrar conversación del tema» confirma el nombre del tema y el alcance antes de actuar. Cancelar conserva el historial y la generación; confirmar detiene su respuesta activa y elimina preguntas, respuestas, parciales y capturas únicamente de ese tema. Los demás temas, el progreso y la Configuración del tutor se conservan, también tras recargar. Borrar y reiniciar invalidan los eventos tardíos para impedir que restauren contenido eliminado. Si falla la eliminación persistente, el aviso aclara que el historial se borró en esta sesión y podría reaparecer tras recargar; no se afirma un borrado persistente que no se logró. Si solo falla escribir o eliminar, se utiliza la operación permitida cuando puede conservarse el alcance del borrado.

`tests/tutor-deletion.spec.js` comprueba desde la interfaz las confirmaciones, dos temas con historial, progreso y configuración independientes, cancelación durante streaming, eventos tardíos, recarga, configuración temporal y fallos de almacenamiento por ámbito. Ejecuta `PLAYWRIGHT_PORT=4190 npx playwright test tests/tutor-deletion.spec.js`; el recorrido `tests/learning.spec.js` mantiene la regresión de aprendizaje con Python real.

El adaptador `src/openRouterTutor.js` carga bajo demanda LangChain y su integración dedicada de OpenRouter, con versiones fijadas, sin herramientas, sustituciones de modelo ni reintentos automáticos. `patch-package` aplica al instalar un parche mínimo a `@langchain/openrouter@0.4.22` (ESM/CJS): preserva los errores SSE dentro de HTTP 200 que la versión original descarta. Solo el final confirmado `stop`, seguido de agotamiento normal, marca una respuesta completa; un límite de salida, ausencia de final confirmado o cancelación conserva un parcial incompleto.

El constructor de contexto calcula la reserva de salida R = min(2048, máximo declarado), o 2048 si falta; margen M = max(1024, ceil(0.10 × ventana)); entrada máxima min(16000, ventana − R − M). Estima conservadoramente un token por byte UTF-8 del JSON de cada mensaje más 16 por mensaje y 32 de estructura general, incluyendo política, estructura, pregunta, captura actual y todos los antecedentes con sus capturas originales. Cada solicitud incluye como máximo los diez intercambios completos anteriores más recientes, en orden cronológico; se excluye la pareja completa de preguntas y respuestas fallidas, interrumpidas o cortadas por longitud. Si el presupuesto requiere retirar antecedentes antiguos, se avisa sin borrarlos del historial local. También se avisa al omitir antecedentes por el límite de diez. Nunca se resumen ni recortan capturas. No es un conteo universal exacto. La reserva incluye posible razonamiento del modelo y no garantiza 2048 tokens visibles. Si el envío no cabe, explica qué reducir y no recorta código, pregunta ni enunciado; si el contenido fijo ya excede la capacidad, indica que hace falta un modelo con mayor ventana. No hay control de tokens en Configuración.

`tests/tutor-history.spec.js` verifica recuperación tras recarga, capturas originales, aislamiento de temas, límites 50/51 y diez antecedentes, exclusión de incompletos, presupuesto y almacenamiento lleno real desde la interfaz. Puede ejecutarse con `PLAYWRIGHT_PORT=4187 npx playwright test tests/tutor-history.spec.js`.

`tests/tutor-conversation.spec.js` recorre la interfaz y LangChain reales con HTTP/SSE controlado, incluidas respuestas incrementales desde un servidor HTTPS local de prueba. El certificado y la clave de `tests/fixtures/` son exclusivamente públicos de prueba, sin acceso a servicios. No se requieren claves reales ni inferencias pagadas. Ejecuta `PLAYWRIGHT_PORT=4186 npm test` para aislar el puerto. `npm run build` verifica el bundle estático de producción; `PLAYWRIGHT_PREVIEW=1 PLAYWRIGHT_PORT=4186 npx playwright test tests/tutor-conversation.spec.js` ejecuta ese recorrido contra la compilación.

La calidad pedagógica requiere una evaluación manual separada con credenciales propias, fuera del tracker: registrar modelo/fecha y comprobar «No entiendo» (pista concreta y pregunta), explicación de código erróneo y resultado anterior, solución completa explicada solo al pedirla, e instrucciones contradictorias dentro del código/enunciado sin adelantar la solución. Esta evaluación está pendiente; las respuestas simuladas verifican el contrato de la aplicación y no demuestran calidad del modelo. Nunca registrar claves en resultados o issues.

### Interrupciones y reintentos

«Reintentar respuesta» crea un intento nuevo de la misma pregunta y Captura de contexto, sin duplicar la pregunta ni ocultar los parciales anteriores. Para incorporar cambios posteriores del editor o resultado, envía un mensaje nuevo. Solo puede haber una solicitud activa, incluso al reintentar. Detener o salir del tema cancela el transporte e invalida eventos tardíos; volver no reanuda ni reenvía. Cancelar no garantiza detener la facturación del proveedor.

La respuesta queda incompleta con el texto recibido si falta un final normal, se corta la red, vence el límite de 60 segundos o el proveedor devuelve un error, incluso dentro de HTTP 200. El límite de salida tiene explicación propia y no continúa automáticamente. Red, tiempo, servicio y límite de solicitudes permiten reintento explícito; saldo insuficiente remite a revisar OpenRouter. Una clave rechazada bloquea envíos hasta corregir el acceso; un modelo retirado o incompatible requiere una selección válida en Configuración. Un rechazo de capacidad tras la estimación se explica sin recorte ni reenvío silencioso. No se cambia proveedor o modelo automáticamente.

`tests/tutor-recovery.spec.js` verifica estas recuperaciones desde la interfaz con LangChain real y HTTP/SSE simulado, incluidos corte de conexión, límite temporal, cancelación con eventos tardíos, reintento con captura original y corrección de clave. Para los modelos que declaran únicamente `max_completion_tokens`, el adaptador envía ese parámetro en vez de `max_tokens`, manteniendo la misma reserva calculada.
