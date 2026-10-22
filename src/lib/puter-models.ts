// An empty id means "let Puter choose its current default model", which is the
// most durable choice: Puter rotates model availability without notice.
// The named entries are provider-qualified ids from Puter's model directory;
// they draw on Puter's free monthly allowance rather than a local API key.
export const PUTER_MODELS = [
  { id: "", label: "Puter default" },
  { id: "openai/gpt-5-nano", label: "GPT-5 Nano · free" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash · free" },
  { id: "deepseek/deepseek-chat", label: "DeepSeek Chat · free" },
];
