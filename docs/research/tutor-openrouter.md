# OpenRouter y motor del tutor conversacional

Investigación para [#19](https://github.com/soloidx/python-tutor/issues/19), mapa [#18](https://github.com/soloidx/python-tutor/issues/18). Consultado: 2026-11-06 (Lima; comprobación HTTP: 2026-11-07 03:18 UTC). Investigación, sin implementación ni decisión de producto.

## Viabilidad en navegador

**Sí es viable usar OpenRouter directamente desde la app estática.** Su API admite solicitudes `fetch` con bearer token y streaming. OpenRouter documenta además el flujo de claves propias mediante OAuth PKCE; es una alternativa futura a pegar la clave, no un requisito nuevo. [Autenticación propia](https://openrouter.ai/docs/guides/overview/auth/oauth), [streaming](https://openrouter.ai/docs/api_reference/streaming).

Comprobación directa, sin credenciales, contra la infraestructura oficial: `OPTIONS https://openrouter.ai/api/v1/chat/completions`, con `Origin: https://soloidx.github.io`, método solicitado POST y cabeceras authorization/content-type, devolvió **204**, `Access-Control-Allow-Origin: *`, POST y ambas cabeceras permitidas. `GET https://openrouter.ai/api/v1/models` devolvió **200** y origen `*`. Esto verifica CORS actual, no una generación autenticada ni una garantía futura. No hace falta proxy CORS para esas condiciones.

La clave propia se introduce en ejecución; nunca en `VITE_*`, porque Vite la incorporaría al bundle público. [Vite 7](https://v7.vite.dev/guide/env-and-mode).

La persistencia local ya está confirmada por el usuario: `localStorage` basta para clave y modelo. Sobrevive recargas y sesiones, depende del origen y puede fallar o ser borrado por el navegador. Memoria/sessionStorage no cumplen persistencia entre sesiones; IndexedDB añade complejidad sin ocultar la clave a scripts del mismo origen. Cualquier script ejecutado con ese origen puede acceder a ella: persistir no equivale a mantener un secreto de servidor. Propuesta: capturar fallos de escritura, no declarar “guardada” sin éxito, permitir borrarla y evitar logs de credenciales. [Estándar Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).

## Catálogo, acceso y compatibilidad

`GET /api/v1/models` informa `id`, modalidades, contexto, precios y `supported_parameters`. Filtrar entrada/salida de texto; conservar el ID exacto y refrescar el catálogo. No todos los modelos admiten los mismos parámetros; limitarse a los compatibles. El catálogo no certifica calidad pedagógica ni disponibilidad de una generación concreta. [Referencia de modelos](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties).

`GET /api/v1/models/user`, autenticado, filtra por preferencias de proveedores, privacidad y guardrails de la cuenta: mejor referencia de elegibilidad que el catálogo global. No garantiza saldo ni capacidad inmediata. [Modelos de usuario](https://openrouter.ai/docs/api/api-reference/models/list-models-filtered-by-user-provider-preferences-privacy-settings-and-guardrails).

`GET /api/v1/key` comprueba autenticación sin generar tokens y devuelve límites/uso. **Clave válida ≠ saldo suficiente ≠ modelo utilizable**: `limit_remaining` describe el tope de esa clave, no el saldo de cuenta; hay además presupuestos y restricciones de modelos gratuitos. Una inferencia sigue pudiendo fallar. Propuesta: separar “acceso validado” de “generación disponible”; no exigir un saldo positivo inferido de ese campo ni realizar una prueba de pago silenciosa. [Clave actual](https://openrouter.ai/docs/api/api-reference/api-keys/get-current-api-key), [límites](https://openrouter.ai/docs/api_reference/limits).

OpenRouter sigue siendo la única integración habilitada. OpenAI/Anthropic como integraciones independientes permanecen deshabilitadas; sus modelos ofrecidos **dentro de OpenRouter** son otra cosa y el selector deberá expresar esa diferencia (requisito del mapa).

## Streaming y fallos

Enviar `stream: true`; consumir SSE con parser que tolere fragmentación, comentarios y `[DONE]`, acumulando deltas. `AbortController` cancela la conexión. La detención del cómputo/facturación depende del proveedor: OpenAI y Anthropic figuran soportados; Google y Groq, entre otros, no. No prometer coste cero al detener. [Streaming y cancelación](https://openrouter.ai/docs/api_reference/streaming).

Distinguir 401 (credenciales), 402 (créditos), 403 (restricciones), 429 (límite), 502/503 (proveedor/disponibilidad) y red/CORS. Revisar `error` también con HTTP 200: los fallos tras iniciar la respuesta llegan en SSE con `finish_reason: error`. Conservar texto parcial marcado incompleto; no reintentar silenciosamente una generación parcial. Respetar `Retry-After` cuando sea legible desde el navegador y usar espera acotada; su exposición CORS no quedó confirmada en esta comprobación. [Errores oficiales](https://github.com/OpenRouterTeam/docs/blob/main/api_reference/errors-and-debugging.mdx).

## Comparación técnica

| Opción | Chat actual sin herramientas | Navegador y extensión |
|---|---|---|
| Adaptador directo (`fetch` + parser SSE) | Menor superficie; implementa transporte, cancelación y errores explícitamente. | APIs web nativas; un contrato propio de mensajes/eventos permite reutilizarlo en learning paths. Inferencia técnica a partir de la API anterior. |
| LangChain JS | `@langchain/openrouter` + `@langchain/core` ofrecen `ChatOpenRouter`, `invoke` y `stream`; no obliga a usar agentes/herramientas. | LangChain declara soporte Browser. Aporta abstracciones de mensajes/modelos y salida estructurada; no elimina validar acceso, catálogo ni almacenamiento. [Integración](https://docs.langchain.com/oss/javascript/integrations/chat/openrouter), [entornos oficiales](https://www.npmjs.com/package/langchain). |
| LangGraph JS | Añade estado, nodos, transiciones y checkpoints para una interacción que hoy solo necesita una llamada contextual. | Útil si learning paths exige flujos con ramificaciones/reanudación. No exige LangChain. Su SDK frontend documentado conecta a un servidor; eso no acredita por sí solo ejecutar el grafo dentro de esta SPA. Compatibilidad del grafo embebido con versiones actuales/Vite queda por verificar; no se probó bundle. [Runtime](https://docs.langchain.com/oss/javascript/langgraph/overview), [frontend](https://docs.langchain.com/oss/javascript/langgraph/frontend/overview). |

## Recomendación y decisiones pendientes

Recomendación técnica, pendiente de decisión: comenzar evaluando adaptador directo detrás de un contrato pequeño (`messages`, `model`, `signal` → eventos de texto/uso/error); LangChain es razonable si sus abstracciones aportan valor inmediato. Reservar LangGraph para requisitos concretos de orquestación. No se midieron tamaños ni latencia ni se eligió biblioteca.

El constructor del contexto debe aceptar únicamente tema, enunciado, borrador y último resultado; excluir comprobaciones internas y soluciones de pistas. Política del tutor: pistas primero, solución ante petición explícita, sin herramientas para editar/ejecutar. Separar contexto/política/transporte facilita reutilización sin construir learning paths ahora (propuesta derivada del mapa).

Queda decidir biblioteca, modelo inicial, límites de contexto/salida, tratamiento del historial y criterio visible para habilitar chat. No hubo clave real, inferencias pagadas ni validación pedagógica entre modelos.
