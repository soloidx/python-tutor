# Prototipo descartable: reglas declarativas y ejecutor separado

Responde a [Probar el ejecutor separado y la corrección por reglas declarativas](https://github.com/soloidx/python-tutor/issues/82). No se integra ni despliega.

Desde la raíz de esta rama:

```sh
python3 src/personal-validation.prototype/serve.py
```

Abrir <http://127.0.0.1:8871>. Ctrl+C cierra los dos servidores. Requiere Python 3.9+ y assets preparados Pyodide 0.28.3. En un worktree de este repositorio encuentra `public/runtime` del checkout principal; en otro equipo ejecutar antes la preparación habitual del proyecto (`npm ci`) o indicar `--runtime-dir /ruta/a/los/assets`. No descarga nada al arrancar el servidor.

Esta prueba necesita dos orígenes HTTP y cabeceras de respuesta; por eso no se abre por doble clic como una simulación HTML. Ambos servidores solo escuchan loopback. No hay almacenamiento, cookies, cuenta, clave LLM ni conexión al catálogo. No introducir datos personales. La separación por puerto simula orígenes diferentes; no representa el hosting final ni una política de cookies entre dominios desplegados.

## Qué comprobar

- Recorrer las pestañas: aprobación, rechazo, sintaxis inválida, tipo no admitido, salida excesiva, cancelación y regla fuera de perfil.
- Comparar reglas, observaciones y veredicto por separado. Python no recibe las reglas ni envía un campo `passed` reconocido por la página.
- En «Cancelar y recuperar», iniciar el cálculo, pulsar Cancelar y ejecutar el caso correcto. Cada ejecución destruye el worker anterior y crea otro intérprete.
- Explorar texto, booleanos y números finitos de magnitud no superior a `Number.MAX_SAFE_INTEGER`; no admite listas, objetos, funciones, None ni enteros fuera del rango. Se comparan tipo y valor; deben cumplirse todas las reglas. La salida usa `trimEnd()`, como el runtime actual: no distingue blancos finales. Esto debe decidirse expresamente antes de llevarlo a producción.

## Arquitectura de la demo

La página del puerto 8871 guarda reglas y calcula el veredicto. El supervisor 8872 recibe solo código y nombres de variables; precarga tres assets públicos y crea un worker URL. El servidor concatena las dos librerías JS locales de Pyodide, el protocolo cerrado compartido y el adaptador del prototipo. El worker arranca desde bytes, sin descargar paquetes, comprueba la versión y envía observaciones de tipos limitados por un MessagePort privado. El supervisor no usa el canal público worker.onmessage para recibir resultados; el puerto no se entrega al código Python. Captura el método de lectura del diccionario antes de ejecutar y calcula el tipo mediante typeof, sin evaluar checks Python. Su respuesta tiene CSP propia con `connect-src 'none'` y `worker-src 'none'`, distinta de la del supervisor, que carga assets y crea el worker. No se modifica el paquete Pyodide.

El supervisor impone 45 s de carga y 10 s de ejecución, con fases explícitas: un ready duplicado no renueva el plazo. Destruye el worker, cierra el puerto y aborta cargas pendientes antes de confirmar la cancelación. La UI muestra primero Cancelando y espera el acuse; ante falta de confirmación, descarta y reinicia el ejecutor. La salida excesiva invalida el caso, aunque se conserva un prefijo acotado internamente. La regla y el código tienen límites de entrada; el emisor y la instancia se comprueban en los mensajes ordinarios.

## Límites de lo demostrado

Es una prueba funcional conducible por el usuario, no una revisión de seguridad. `jsglobals: {}` reduce lo expuesto por el módulo `js`, pero no se presenta como garantía de confinamiento. El runtime, observaciones y transporte aún requieren revisión independiente. La página calcula un resultado independiente a partir de los datos recibidos; eso no certifica por sí solo la integridad de cómo se obtuvieron esos datos.

No se reproducen pruebas de manipulación ni evasión rechazadas previamente. Hay pruebas de regresión con fixtures de tipos, fases, duplicados, cancelación, aborto de carga y puerto privado. No hay cuotas duras de memoria, pruebas de agotamiento, revisión exhaustiva de los binarios Pyodide ni validación del hosting final. No declarar habilitado el feature basándose en esta demo. No se cambia el contrato de cursos originales ni se corrige todavía contenido personal en Aprender/Práctica.

## Verificación funcional realizada

2026-11-10, Chromium headless **151.0.7922.34** en macOS ARM64, Playwright desde un proceso independiente (sin sesión del usuario):

| Recorrido | Observado |
| --- | --- |
| Solución correcta con dos reglas | Aprobado |
| Programa que devuelve 41 en lugar de 42 | No aprobado |
| Sintaxis inválida | Error de Python |
| Variable lista | Tipo no admitido |
| Salida de 20.001 caracteres | Límite excedido |
| Regla fuera del esquema | Regla no admitida, sin iniciar Python |
| Cancelar cálculo finito y ejecutar caso correcto | Cancelado, después Aprobado |
| Texto y booleano | Aprobado |
| Texto `"42"` frente a número `42` | No aprobado |
| Nueva ejecución consulta variable del intento anterior | Ausente |

No hubo errores de página observados. Revisión visual a 1280 px y 390 px; sin desbordamiento horizontal en el ancho móvil. La respuesta de `/worker.js` contenía la política documentada. Las peticiones ordinarias observadas fueron a ambos documentos locales, tres assets y el script worker. Esto no demuestra ausencia universal de red ni sustituye las pruebas de la frontera.

Firefox, WebKit, móviles reales y hosting final no fueron probados. No se ensayaron presión de memoria, manipulación de mensajes o intérprete, ni agotamiento deliberado. Se comprobó cancelación ordinaria; no se esperó el timeout completo de diez segundos ni un fallo de carga de 45 s. La decisión HITL permanece abierta hasta reacción del usuario.


## Corrección y comprobaciones reproducibles

Después de la aprobación funcional se corrigieron el esquema, las fases, la cancelación y el canal. Los cinco casos de regresión iniciales fallaban en `06005de`; ahora pasan los doce casos de `verify-protocol.cjs`, que ejecutan los handlers reales con fixtures acotados:

```sh
node src/personal-validation.prototype/verify-protocol.cjs
```

Con el servidor abierto y las dependencias del proyecto preparadas:

```sh
PROTOTYPE_ENGINES=Chrome,WebKit node src/personal-validation.prototype/verify-browser.cjs
```

El script encuentra Playwright en el checkout principal cuando se ejecuta desde un worktree. Se puede indicar `PROTOTYPE_URL` y guardar el resultado con `PROTOTYPE_RESULTS`. WebKit se instala con el comando habitual de Playwright si falta; no se instala durante la prueba. Firefox es una opción del script, pero su ejecutable local falló antes de cargar la demo: no está verificado.

La comprobación de política usa `policy-conformance.js`: un worker de fixture benigno intenta cargar un recurso público vacío y crear un worker de fixture. Ambos reciben la misma cabecera de política que el worker Python. Se comprueban denegaciones y eventos CSP; no ejecuta Python ni trata datos del usuario. El evento de error asíncrono cuenta, no solo que el constructor devuelva un objeto.

**Resultados actuales:** Chrome 157.0.8103.39 y WebKit 27.2 pasaron origen/almacenamiento separados, bloqueo de conexión y worker secundario, aprobación/rechazo/error/tipo/salida/reglas, cancelación confirmada, plazo de diez segundos y recuperación. No hubo errores de página observados. Los resultados antiguos de la sección anterior son historia del prototipo inicial, no el alcance de la corrección actual.

La viabilidad de este perfil no es una autorización para producción. Antes de activarlo se deben servir y comprobar las mismas políticas en el origen dedicado final, sin credenciales/cookies compartidas con la aplicación, con runtime fijado y motores admitidos comprobados. Si la política o bootstrap no funcionan, no hay fallback al worker del origen de la aplicación ni incorporación parcial. Las limitaciones de RAM y pruebas pedagógicas finitas siguen vigentes.
