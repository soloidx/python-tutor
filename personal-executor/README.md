# Ejecutor personal separado

Este paquete prepara un ejecutor para un origen dedicado, sin cookies ni datos de la aplicación. No habilita contenido personal ni constituye una comprobación del hosting final. La aplicación todavía no dispone de incorporación personal validada; solo las fixtures de pruebas suministran `personalExecution` al workspace.

Preparar una distribución estática con los assets de Pyodide 0.28.3 ya instalados:

```sh
node personal-executor/build.mjs public/runtime /ruta/de/salida https://app.ejemplo
```

El proceso comprueba SHA-256 y tamaño de los cinco assets y falla si difieren. El supervisor vuelve a comprobar los tres assets binarios antes de cada precarga (se pueden reutilizar en memoria tras validarlos). El archivo `_headers` documenta las cabeceras necesarias; el hosting debe aplicarlas realmente, en particular la CSP propia de `worker.js`, y servir el origen sin cookies ni credenciales compartidas. La URL debe usar HTTPS y ser un origen distinto de la aplicación. No activar la funcionalidad antes de comprobar las políticas, el bootstrap, el aislamiento de almacenamiento y los motores admitidos en el hosting real. Los puertos locales solo simulan orígenes y no prueban la política de cookies entre dominios.

El cliente conserva las reglas y solo envía código y nombres. Un worker nuevo devuelve observaciones por un puerto privado; el cliente valida las fases y calcula el veredicto. Cancelar aborta la precarga, termina el worker y cierra el puerto antes del acuse. Un watchdog descarta y recrea el frame si no llega el acuse. Los límites de tiempo y tamaño no son una cuota dura de RAM ni garantizan disponibilidad. No existe fallback al worker original.

## Comprobaciones locales

Con dependencias instaladas y runtime preparado, en terminales separadas:

```sh
python3 tests/fixtures/personal-executor/serve.py
node tests/fixtures/personal-executor/verify-protocol.cjs
node tests/fixtures/personal-executor/verify-client.cjs
PROTOTYPE_ENGINES=Chrome,WebKit node tests/fixtures/personal-executor/verify-browser.cjs
```

Para el recorrido de interfaz, iniciar Vite en el puerto 4173 y el servidor de fixture con `--app-origin http://127.0.0.1:4173`, luego ejecutar `node tests/fixtures/personal-executor/verify-ui.cjs`. La página de fixture está fuera de la entrada de producción y no incorpora contenido al catálogo. Las pruebas de protocolo simuladas comprueban fases y cancelación, no aislamiento; las comprobaciones de navegador usan dos servidores locales y políticas reales. Firefox, dispositivos reales y despliegue final requieren comprobación adicional antes de habilitar.
