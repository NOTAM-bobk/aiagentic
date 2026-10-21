export type BuilderId = "gemini" | "groq" | "puter";
export type PlannerId = "groq";

export type ModelOption = {
  id: string;
  label: string;
  provider: "Groq" | "Google AI Studio" | "Puter";
  model: string;
  role: "planner" | "builder";
  blurb: string;
  /** Requires a server-side key. Puter runs in the browser with no key. */
  needsKey: boolean;
};

export const PLANNER_MODEL = process.env.GROQ_PLANNER_MODEL ?? "openai/gpt-oss-120b";
export const BUILDER_MODEL = process.env.GOOGLE_BUILDER_MODEL ?? "gemini-3.8-flash";
export const GROQ_BUILDER_MODEL = process.env.GROQ_BUILDER_MODEL ?? "openai/gpt-oss-120b";

export const PLANNERS: ModelOption[] = [
  {
    id: "groq",
    label: "Groq",
    provider: "Groq",
    model: PLANNER_MODEL,
    role: "planner",
    blurb: "Sub-second planning and reasoning",
    needsKey: true,
  },
];

export const BUILDERS: ModelOption[] = [
  {
    id: "gemini",
    label: "Gemini 3.8 Flash",
    provider: "Google AI Studio",
    model: BUILDER_MODEL,
    role: "builder",
    blurb: "Strong long-horizon code generation",
    needsKey: true,
  },
  {
    id: "groq",
    label: "GPT-OSS 120B",
    provider: "Groq",
    model: GROQ_BUILDER_MODEL,
    role: "builder",
    blurb: "Fast edits, very low cost",
    needsKey: true,
  },
  {
    id: "puter",
    label: "Puter (free)",
    provider: "Puter",
    model: "claude-sonnet-4-5",
    role: "builder",
    blurb: "No API key · runs in your browser",
    needsKey: false,
  },
];

export type Capabilities = {
  groq: boolean;
  google: boolean;
  tavily: boolean;
  daytona: boolean;
  composio: boolean;
  puter: boolean;
};

export function readCapabilities(): Capabilities {
  return {
    groq: Boolean(process.env.GROQ_API_KEY),
    google: Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GOOGLE_API_KEY),
    tavily: Boolean(process.env.TAVILY_API_KEY),
    daytona: Boolean(process.env.DAYTONA_API_KEY),
    composio: Boolean(process.env.COMPOSIO_API_KEY),
    puter: true,
  };
}
