export type BuilderProvider = "gemini" | "groq" | "puter";

export type BuilderOption = {
  id: string;
  label: string;
  provider: BuilderProvider;
  model: string;
  blurb: string;
  /** Requires a server-side provider key. Puter runs in the browser. */
  needsKey: boolean;
};

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

export const BUILDER_OPTIONS: BuilderOption[] = [
  {
    id: "gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    provider: "gemini",
    model: DEFAULT_GEMINI_MODEL,
    blurb: "Default · strong long-horizon code generation",
    needsKey: true,
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "gemini",
    model: "gemini-2.5-flash",
    blurb: "Stable fallback if 3.8 is unavailable on your key",
    needsKey: true,
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "gemini",
    model: "gemini-2.5-pro",
    blurb: "Slower, strongest reasoning",
    needsKey: true,
  },
  {
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash Lite",
    provider: "gemini",
    model: "gemini-2.5-flash-lite",
    blurb: "Cheapest and fastest Gemini",
    needsKey: true,
  },
  {
    id: "groq-gpt-oss-120b",
    label: "GPT-OSS 120B",
    provider: "groq",
    model: DEFAULT_GROQ_MODEL,
    blurb: "Groq · fast edits, very low cost",
    needsKey: true,
  },
  {
    id: "puter",
    label: "Puter (free)",
    provider: "puter",
    model: "",
    blurb: "No API key · runs in your browser",
    needsKey: false,
  },
];

/** Accepts both new ids and the legacy provider ids saved by older projects. */
export function resolveBuilder(id: string | undefined | null): BuilderOption {
  const direct = BUILDER_OPTIONS.find((option) => option.id === id);
  if (direct) return direct;
  if (id === "gemini") return BUILDER_OPTIONS.find((option) => option.provider === "gemini")!;
  if (id === "groq") return BUILDER_OPTIONS.find((option) => option.provider === "groq")!;
  if (id === "puter") return BUILDER_OPTIONS.find((option) => option.provider === "puter")!;
  return BUILDER_OPTIONS[0];
}

export function providerLabel(provider: BuilderProvider): string {
  if (provider === "gemini") return "Gemini";
  if (provider === "groq") return "Groq";
  return "Puter";
}
