export const KEY_HEADER = "x-kiln-keys";

export const API_KEY_FIELDS = [
  {
    id: "groq",
    env: "GROQ_API_KEY",
    label: "Groq",
    purpose: "Thinking, planning, titles",
    href: "https://console.groq.com/keys",
  },
  {
    id: "google",
    env: "GOOGLE_GENERATIVE_AI_API_KEY",
    label: "Google AI Studio",
    purpose: "Building the site",
    href: "https://aistudio.google.com/apikey",
  },
  {
    id: "tavily",
    env: "TAVILY_API_KEY",
    label: "Tavily",
    purpose: "Web search",
    href: "https://app.tavily.com/home",
  },
  {
    id: "daytona",
    env: "DAYTONA_API_KEY",
    label: "Daytona",
    purpose: "Cloud sandbox + live previews",
    href: "https://app.daytona.io/dashboard/keys",
  },
  {
    id: "composio",
    env: "COMPOSIO_API_KEY",
    label: "Composio",
    purpose: "Connectors (GitHub, Supabase, Stripe…)",
    href: "https://app.composio.dev/developers",
  },
  {
    id: "github",
    env: "GITHUB_TOKEN",
    label: "GitHub token",
    purpose: "Push commits to GitHub",
    href: "https://github.com/settings/tokens",
  },
] as const;

export type ApiKeyId = (typeof API_KEY_FIELDS)[number]["id"];
export type ApiKeyMap = Partial<Record<ApiKeyId, string>>;

const IDS = new Set<string>(API_KEY_FIELDS.map((field) => field.id));

/** Drop unknown ids, trim values, and ignore anything implausible in length. */
export function sanitizeApiKeys(input: unknown): ApiKeyMap {
  if (!input || typeof input !== "object") return {};
  const output: ApiKeyMap = {};
  for (const [id, value] of Object.entries(input as Record<string, unknown>)) {
    if (!IDS.has(id)) continue;
    if (typeof value !== "string") continue;
    const clean = value.trim().slice(0, 4096);
    if (clean.length > 0) output[id as ApiKeyId] = clean;
  }
  return output;
}
