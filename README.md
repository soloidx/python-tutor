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

- `src/curriculum.js`: contenido en español, código inicial, pistas progresivas y expresiones Python de comprobación. Cada ejercicio necesita un identificador globalmente único. Las expresiones pueden consultar las variables del programa y `_output` (salida sin salto de línea final).
- `src/assessment.js`: seis preguntas de evaluación final con respuestas y explicaciones deterministas.
- `src/App.jsx`: entrada de cursos, selección de tema, ejercicios completados y evaluación final.
- `src/progress.js`: lectura validada y escritura del progreso en el almacenamiento local del navegador.
- `src/usePython.js`: estados de carga, ejecución y recuperación del intérprete.
- `public/python-worker.js`: Pyodide en un Web Worker, con un diccionario Python nuevo para cada ejecución. No es un servidor ni un entorno para ejecutar código de otras personas.
- `tests/learning.spec.js`: un recorrido completo mediante la interfaz real y Pyodide, con recarga, reapertura y reinicio del progreso.

Un error o un resultado incorrecto no borra los ejercicios ya completados. Los borradores de código y las pistas se reinician al cambiar de ejercicio. La ejecución tiene un límite de 10 segundos; reiniciar Python termina el Worker y crea un intérprete nuevo.

## Progreso en este navegador

La ruta elegida, la pantalla actual, el tema, los ejercicios y temas completados y el último resultado de evaluación final se guardan automáticamente en `localStorage`. Al recargar o volver a abrir el sitio en el mismo navegador y origen (protocolo, dominio y puerto), puedes continuar. El resultado conserva también las respuestas para revisar las explicaciones, incluso si no acertaste todas las preguntas.

Los borradores de código, la salida de la consola, las pistas y las respuestas de una evaluación sin enviar no se guardan. Cada recarga empieza el primer ejercicio del tema actual con su código inicial. La configuración del tutor se guarda por separado; las conversaciones de tutoría se guardan por tema en este navegador, sin sincronización entre dispositivos.

«Reiniciar progreso» pide confirmación, borra los ejercicios completados y la evaluación final y vuelve al primer tema. El aviso de almacenamiento explica si el navegador no permite guardar o borrar los datos; puedes seguir aprendiendo durante la sesión. Si los datos guardados están dañados, la aplicación abre el inicio de forma segura. Borrar los datos del sitio desde el navegador también elimina el progreso.

## Configuración del tutor

En Aprender, las pestañas Lección y Tutor comparten el espacio izquierdo; el editor y la consola siguen disponibles y conservan su estado al alternarlas o abrir Configuración. En pantallas estrechas se apilan. Las pestañas admiten flechas, Inicio y Fin. El diálogo admite navegación por teclado, Escape y retorno del foco; guardar abre y enfoca Tutor.

Configuración se abre desde la navegación general, el encabezado de Tutor o «Configurar tutor». OpenRouter es el único proveedor habilitado; OpenAI, Anthropic y modelos locales se muestran deshabilitados. La lectura y la ejecución de Python no requieren configurar el tutor.

Introduce tu propia clave en ejecución y pulsa «Validar clave». Se consulta [`GET /key`](https://openrouter.ai/docs/api-reference/limits) y el [catálogo filtrado por cuenta](https://openrouter.ai/docs/api/api-reference/models/list-models-filtered-by-user-provider-preferences-privacy-settings-and-guardrails), con alternativa al catálogo público únicamente si el endpoint filtrado no está disponible. Estas comprobaciones no generan respuestas ni verifican saldo o disponibilidad de generación. Un rechazo solicita corregir la clave; los problemas de conexión o servicio permiten reintentar.

Busca y selecciona un modelo explícitamente: no existe selección predeterminada ni sustitución automática. Solo son elegibles modelos con entrada/salida de texto, ventana de contexto conocida y soporte declarado de límite de salida. Los demás muestran el motivo. La ausencia del máximo de salida no impide elegir un modelo; sus metadatos completos se conservan para calcular el presupuesto de conversación posteriormente.

Los campos son cambios pendientes. «Guardar y volver al tutor» vuelve a comprobar clave y modelo antes de reemplazar la configuración. Cancelar o fallar conserva la anterior. La clave y los metadatos del modelo se guardan en `localStorage`, separados del progreso, y se recuperan tras recargar con «Comprobando acceso…» antes de habilitar el envío. Si el modelo desaparece o deja de ser compatible, hay que seleccionar otro; si falla la red, se conserva lo guardado y se ofrece reintentar. Reiniciar el progreso conserva esta configuración.

La clave se guarda sin cifrar en este navegador y origen; evita un dispositivo compartido. No se incluye en el bundle ni se configura mediante variables de compilación. Si falla la escritura local, la aplicación no afirma que haya guardado: ofrece «Usar solo en esta sesión» mediante una elección explícita y avisa de su pérdida al recargar. Borrar los datos del sitio elimina también este acceso. El envío se habilita únicamente con acceso comprobado.

`tests/tutor-access.spec.js` prueba la interfaz real y la persistencia con credenciales ficticias, simulando solo el HTTP de OpenRouter y los fallos de almacenamiento del navegador. Inspecciona las solicitudes para asegurar que validar/guardar/recargar no genera respuestas. La suite conserva el recorrido de aprendizaje con Pyodide real y no requiere inferencias pagadas. Para ejecutar otra copia en paralelo, usa `PLAYWRIGHT_PORT=4185 npm test`.

## Tutor contextual

Envía una pregunta desde Tutor con Enter; Mayús+Enter añade una línea. La respuesta aparece por partes. «Detener» cancela el transporte y conserva el parcial identificado como incompleto. Salir del tema también cancela; volver no reenvía. Cambiar de ejercicio dentro del mismo tema permite seguir la respuesta, que conserva el nombre del ejercicio original. Guardar una configuración válida interrumpe la generación anterior. El texto y los bloques de código se muestran como contenido; «Copiar código» copia al portapapeles y el estudiante decide cómo editar y ejecutar.

Cada envío fija una Captura de contexto: identificación y contenido visible del tema, enunciado, borrador y último resultado de ese ejercicio. Si el borrador cambió, el resultado se marca anterior y lleva el código que lo produjo. Los cambios posteriores de código o ejecución se incorporan al siguiente envío. No se envían comprobaciones internas ni soluciones de las pistas. Cada Conversación de tema se guarda en `localStorage` con sus preguntas, respuestas, identificaciones de ejercicio y capturas originales. Los ejercicios del tema comparten el hilo; otros temas mantienen conversaciones independientes. Guardar una captura no restaura el borrador ni el resultado en el espacio de práctica. Se conservan hasta 50 intercambios por tema, incluidos los incompletos; al crear el 51 se elimina el más antiguo con aviso. Durante streaming se guarda cada parcial recibido; tras recargar, una respuesta en curso aparece interrumpida, sin reanudarse ni reenviarse. Si falla el almacenamiento, se permite continuar temporalmente con un aviso de pérdida al recargar, independiente de la opción explícita de configuración temporal.

El adaptador `src/openRouterTutor.js` carga bajo demanda LangChain y su integración dedicada de OpenRouter, con versiones fijadas, sin herramientas, sustituciones de modelo ni reintentos automáticos. `patch-package` aplica al instalar un parche mínimo a `@langchain/openrouter@0.4.22` (ESM/CJS): preserva los errores SSE dentro de HTTP 200 que la versión original descarta. Solo el final confirmado `stop`, seguido de agotamiento normal, marca una respuesta completa; un límite de salida, ausencia de final confirmado o cancelación conserva un parcial incompleto.

El constructor de contexto calcula la reserva de salida R = min(2048, máximo declarado), o 2048 si falta; margen M = max(1024, ceil(0.10 × ventana)); entrada máxima min(16000, ventana − R − M). Estima conservadoramente un token por byte UTF-8 del JSON de cada mensaje más 16 por mensaje y 32 de estructura general, incluyendo política, estructura, pregunta, captura actual y todos los antecedentes con sus capturas originales. Cada solicitud incluye como máximo los diez intercambios completos anteriores más recientes, en orden cronológico; se excluye la pareja completa de preguntas y respuestas fallidas, interrumpidas o cortadas por longitud. Si el presupuesto requiere retirar antecedentes antiguos, se avisa sin borrarlos del historial local. También se avisa al omitir antecedentes por el límite de diez. Nunca se resumen ni recortan capturas. No es un conteo universal exacto. La reserva incluye posible razonamiento del modelo y no garantiza 2048 tokens visibles. Si el envío no cabe, explica qué reducir y no recorta código, pregunta ni enunciado; si el contenido fijo ya excede la capacidad, indica que hace falta un modelo con mayor ventana. No hay control de tokens en Configuración.

`tests/tutor-history.spec.js` verifica recuperación tras recarga, capturas originales, aislamiento de temas, límites 50/51 y diez antecedentes, exclusión de incompletos, presupuesto y almacenamiento lleno real desde la interfaz. Puede ejecutarse con `PLAYWRIGHT_PORT=4187 npx playwright test tests/tutor-history.spec.js`.

`tests/tutor-conversation.spec.js` recorre la interfaz y LangChain reales con HTTP/SSE controlado, incluidas respuestas incrementales desde un servidor HTTPS local de prueba. El certificado y la clave de `tests/fixtures/` son exclusivamente públicos de prueba, sin acceso a servicios. No se requieren claves reales ni inferencias pagadas. Ejecuta `PLAYWRIGHT_PORT=4186 npm test` para aislar el puerto. `npm run build` verifica el bundle estático de producción; `PLAYWRIGHT_PREVIEW=1 PLAYWRIGHT_PORT=4186 npx playwright test tests/tutor-conversation.spec.js` ejecuta ese recorrido contra la compilación.

La calidad pedagógica requiere una evaluación manual separada con credenciales propias, fuera del tracker: registrar modelo/fecha y comprobar «No entiendo» (pista concreta y pregunta), explicación de código erróneo y resultado anterior, solución completa explicada solo al pedirla, e instrucciones contradictorias dentro del código/enunciado sin adelantar la solución. Esta evaluación está pendiente; las respuestas simuladas verifican el contrato de la aplicación y no demuestran calidad del modelo. Nunca registrar claves en resultados o issues.

### Interrupciones y reintentos

«Reintentar respuesta» crea un intento nuevo de la misma pregunta y Captura de contexto, sin duplicar la pregunta ni ocultar los parciales anteriores. Para incorporar cambios posteriores del editor o resultado, envía un mensaje nuevo. Solo puede haber una solicitud activa, incluso al reintentar. Detener o salir del tema cancela el transporte e invalida eventos tardíos; volver no reanuda ni reenvía. Cancelar no garantiza detener la facturación del proveedor.

La respuesta queda incompleta con el texto recibido si falta un final normal, se corta la red, vence el límite de 60 segundos o el proveedor devuelve un error, incluso dentro de HTTP 200. El límite de salida tiene explicación propia y no continúa automáticamente. Red, tiempo, servicio y límite de solicitudes permiten reintento explícito; saldo insuficiente remite a revisar OpenRouter. Una clave rechazada bloquea envíos hasta corregir el acceso; un modelo retirado o incompatible requiere una selección válida en Configuración. Un rechazo de capacidad tras la estimación se explica sin recorte ni reenvío silencioso. No se cambia proveedor o modelo automáticamente.

`tests/tutor-recovery.spec.js` verifica estas recuperaciones desde la interfaz con LangChain real y HTTP/SSE simulado, incluidos corte de conexión, límite temporal, cancelación con eventos tardíos, reintento con captura original y corrección de clave. Para los modelos que declaran únicamente `max_completion_tokens`, el adaptador envía ese parámetro en vez de `max_tokens`, manteniendo la misma reserva calculada.
