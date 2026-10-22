import { apiKey } from "./keys-server";
import { DEFAULT_GEMINI_MODEL, DEFAULT_GROQ_MODEL } from "./builders";

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
export const BUILDER_MODEL = process.env.GOOGLE_BUILDER_MODEL ?? DEFAULT_GEMINI_MODEL;
export const GROQ_BUILDER_MODEL = process.env.GROQ_BUILDER_MODEL ?? DEFAULT_GROQ_MODEL;

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
    groq: Boolean(apiKey("groq")),
    google: Boolean(apiKey("google") ?? process.env.GOOGLE_API_KEY),
    tavily: Boolean(apiKey("tavily")),
    daytona: Boolean(apiKey("daytona")),
    composio: Boolean(apiKey("composio")),
    puter: true,
  };
}
