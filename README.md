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

Los borradores de código, la salida de la consola, las pistas y las respuestas de una evaluación sin enviar no se guardan. Cada recarga empieza el primer ejercicio del tema actual con su código inicial. No hay conversaciones de tutoría ni sincronización entre dispositivos.

«Reiniciar progreso» pide confirmación, borra los ejercicios completados y la evaluación final y vuelve al primer tema. El aviso de almacenamiento explica si el navegador no permite guardar o borrar los datos; puedes seguir aprendiendo durante la sesión. Si los datos guardados están dañados, la aplicación abre el inicio de forma segura. Borrar los datos del sitio desde el navegador también elimina el progreso.
