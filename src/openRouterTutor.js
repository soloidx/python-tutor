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
    error.kind = signal.aborted
      ? "cancelled"
      : failure.name === "TimeoutError"
        ? "timeout"
        : "provider";
    error.status = failure.statusCode;
    error.code = failure.code;
    error.metadata = failure.metadata;
    throw error;
  }
}
