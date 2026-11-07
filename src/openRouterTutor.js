// Translate provider details here; neither raw messages nor metadata are rendered in the UI.
function failureKind(failure, signal) {
  if (signal.aborted) return "cancelled";
  if (failure.name === "TimeoutError") return "timeout";
  const code = Number(failure.code ?? failure.statusCode);
  const type = String(
    failure.metadata?.error_type || failure.code || "",
  ).toLowerCase();
  const message = String(failure.message || "").toLowerCase();
  if (
    [
      "context_length_exceeded",
      "context_window_exceeded",
      "context_limit_exceeded",
    ].includes(type) ||
    /context.{0,30}(length|window|limit|exceed)|maximum context/.test(message)
  )
    return "context";
  if (
    ["invalid_api_key", "authentication_error", "invalid_key"].includes(type) ||
    code === 401 ||
    (code === 403 &&
      /invalid.{0,15}(key|credential)|key.{0,15}(invalid|revoked|expired)/.test(
        message,
      ))
  )
    return "key";
  if (
    ["insufficient_credits", "insufficient_balance"].includes(type) ||
    code === 402
  )
    return "balance";
  if (
    ["model_not_found", "model_unavailable", "unsupported_model"].includes(
      type,
    ) ||
    /model.{0,60}(not found|retired|no longer|not available|unavailable|incompatible|not supported)|no endpoints found/.test(
      message,
    )
  )
    return "model";
  if (code === 429 || type === "rate_limit_exceeded") return "rate";
  if (code === 408 || code === 504 || type === "timeout") return "timeout";
  if (Number.isFinite(code) && code >= 500) return "service";
  if (
    !failure.statusCode &&
    !failure.code &&
    (failure instanceof TypeError ||
      /network|fetch|connection|terminated/.test(message))
  )
    return "network";
  return "rejected";
}

// The provider boundary owns LangChain; UI and conversation state use application events only.
export async function streamTutor({
  config,
  messages,
  maxTokens,
  signal,
  onText,
}) {
  const { ChatOpenRouter } = await import("@langchain/openrouter");
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const model = new ChatOpenRouter({
    apiKey: config.key,
    model: config.model.id,
    maxTokens,
    maxRetries: 0,
    ...(config.model.supported_parameters?.includes("max_completion_tokens") &&
    !config.model.supported_parameters.includes("max_tokens")
      ? {
          modelKwargs: {
            max_tokens: undefined,
            max_completion_tokens: maxTokens,
          },
        }
      : {}),
    siteName: "Python Tutor",
    siteUrl: window.location.origin,
  });
  let finishReason = null;
  try {
    const stream = await model.stream(messages, { signal, timeout: 60000 });
    for await (const chunk of stream) {
      if (signal.aborted) break;
      if (typeof chunk.content === "string" && chunk.content)
        onText(chunk.content);
      else if (Array.isArray(chunk.content)) {
        for (const part of chunk.content)
          if (part.type === "text") onText(part.text);
      }
      if (chunk.response_metadata?.finish_reason != null)
        finishReason = chunk.response_metadata.finish_reason;
    }
    return { finishReason };
  } catch (failure) {
    const error = new Error(
      failure.message || "No se pudo completar la respuesta.",
    );
    error.name = "TutorTransportError";
    error.kind = failureKind(failure, signal);
    error.status = failure.statusCode;
    error.code = failure.code;
    error.metadata = failure.metadata;
    throw error;
  }
}
