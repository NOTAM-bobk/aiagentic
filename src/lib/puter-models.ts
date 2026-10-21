// An empty id means "let Puter choose its current default model", which is the
// most durable choice: Puter rotates model availability without notice.
export const PUTER_MODELS = [
  { id: "", label: "Puter default" },
  { id: "claude-sonnet-4-5", label: "Claude Sonnet" },
  { id: "gpt-5.4-nano", label: "GPT-5.4 Nano" },
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite" },
];
