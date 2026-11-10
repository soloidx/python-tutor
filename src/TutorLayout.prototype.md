# Prototipo descartable: ubicación del tutor

Pregunta: ¿cómo tener el tutor a mano sin desplazarse debajo del editor y la consola?

Ejecutar `npm run prototype:tutor`. Se abre la ruta existente con
`?tutor-prototype=1&variant=A`. El prototipo solo está disponible en desarrollo.

- A: panel lateral plegable, código y tutor visibles a la vez. En móvil se superpone.
- B: pestañas Ejercicio / Tutor que usan todo el ancho disponible.
- C: ventana flotante que se abre sobre el ejercicio.

La barra inferior cambia variantes con botones o flechas del teclado; no intercepta
las flechas al escribir. También simula la configuración del tutor. Escape cierra
el tutor. Los borradores y mensajes viven en memoria; la conversación se agrupa
por tema. El catálogo se carga mediante el arranque habitual de la aplicación.
La ejecución y las respuestas son simuladas, sin modificar el progreso ni usar una API.

Hipótesis inicial: A permite consultar ayuda mientras se trabaja con el código;
B prioriza el ancho del editor; C deja más espacio pero puede tapar el ejercicio.
Pendiente: elección del usuario. Al validar una opción, archivar este prototipo
en una rama descartable y registrar el veredicto en la issue de implementación,
antes de integrar la solución definitiva.
