// Access checks are GET-only and never request a completion.
const endpoint = "https://openrouter.ai/api/v1";

export class AccessError extends Error {
  constructor(kind, message) {
    super(message);
    this.kind = kind;
  }
}

async function get(path, key, signal) {
  let response;
  try {
    response = await fetch(`${endpoint}${path}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new AccessError(
      "network",
      "No se pudo conectar con OpenRouter. Revisa tu conexión y reintenta la comprobación.",
    );
  }
  if (response.status === 401 || response.status === 403)
    throw new AccessError(
      "credentials",
      "Clave rechazada. Corrige tu clave de OpenRouter y vuelve a validarla.",
    );
  if (!response.ok)
    throw new AccessError(
      "service",
      "OpenRouter no pudo comprobar el acceso. Reintenta en unos momentos.",
    );
  try {
    return await response.json();
  } catch {
    throw new AccessError(
      "service",
      "OpenRouter devolvió una respuesta no válida. Reintenta la comprobación.",
    );
  }
}

export function modelIncompatibility(model) {
  if (
    !model.architecture?.input_modalities?.includes("text") ||
    !model.architecture?.output_modalities?.includes("text")
  )
    return "No admite entrada y salida de texto.";
  if (!Number.isFinite(model.context_length) || model.context_length <= 0)
    return "Ventana de contexto desconocida.";
  if (
    !model.supported_parameters?.some((parameter) =>
      ["max_tokens", "max_completion_tokens"].includes(parameter),
    )
  )
    return "No declara soporte de límite de salida.";
  return "";
}

export async function checkAccess(key, signal) {
  const identity = await get("/key", key, signal);
  if (!identity.data || identity.error)
    throw new AccessError(
      "credentials",
      "No se pudo validar la clave. Corrígela y vuelve a intentarlo.",
    );
  // Only fall back when this API feature is unavailable, never on auth/network errors.
  let response;
  try {
    response = await fetch(`${endpoint}/models/user`, {
      headers: { Authorization: `Bearer ${key}` },
      signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new AccessError(
      "network",
      "No se pudo obtener el catálogo. Revisa tu conexión y reintenta la comprobación.",
    );
  }
  let catalog;
  if ([404, 405, 501].includes(response.status))
    catalog = await get("/models", key, signal);
  else {
    if ([401, 403].includes(response.status))
      throw new AccessError(
        "credentials",
        "Clave rechazada. Corrige tu clave de OpenRouter y vuelve a validarla.",
      );
    if (!response.ok)
      throw new AccessError(
        "service",
        "No se pudo obtener el catálogo de OpenRouter. Reintenta la comprobación.",
      );
    try {
      catalog = await response.json();
    } catch {
      throw new AccessError(
        "service",
        "El catálogo de OpenRouter no es válido. Reintenta la comprobación.",
      );
    }
  }
  if (!Array.isArray(catalog.data))
    throw new AccessError(
      "service",
      "El catálogo de OpenRouter no es válido. Reintenta la comprobación.",
    );
  return catalog.data.filter(
    (model) =>
      model && typeof model.id === "string" && typeof model.name === "string",
  );
}
