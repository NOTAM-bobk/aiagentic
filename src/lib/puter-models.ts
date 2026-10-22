// An empty id means "let Puter choose its current default model", which is the
// most durable choice: Puter rotates model availability without notice.
// The named entries are provider-qualified ids from Puter's model directory;
// they draw on Puter's free monthly allowance rather than a local API key.
export const PUTER_MODELS = [
  { id: "", label: "Puter default" },
  { id: "google/gemini-4-argon", label: "Gemini 4 Argon" },
  { id: "openai/gpt-5-nano", label: "GPT-5 Nano" },
  { id: "anthropic/claude-haiku-5-5", label: "Claude Haiku 5.5" },
  { id: "anthropic/claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
  { id: "anthropic/claude-opus-5-5", label: "Claude Opus 5.5" },
  { id: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "deepseek/deepseek-chat", label: "DeepSeek Chat" },
];
