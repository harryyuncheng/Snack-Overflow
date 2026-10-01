/** Optional Claude polish; always returns the deterministic fallback when no key or on error. */
export async function llm(prompt: string, fallback: string, maxTokens = 600) {
  if (!process.env.ANTHROPIC_API_KEY) return fallback;
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();
    const msg = await client.messages.create({ model: "claude-sonnet-5-5", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] });
    const text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    return text || fallback;
  } catch { return fallback; }
}
