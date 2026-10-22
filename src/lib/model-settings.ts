/**
 * Model settings the user can change from the workspace.
 *
 * Stored in this browser rather than on a project, so the same behaviour
 * follows you across every site. The server never trusts these numbers: each
 * route re-sanitises them before they reach a model.
 */

export type PromptMode = "append" | "replace";

export type ModelSettings = {
  /** Builder temperature. Lower is safer, higher is looser. */
  temperature: number;
  maxOutputTokens: number;
  /** Build rounds per turn, including the review refinement pass. */
  maxRounds: number;
  /** Verify the preview and ask another model for a critique. */
  selfReview: boolean;
  /** Search the web for current craft before refining. */
  webResearch: boolean;
  /** Let the agent draw photographs with the image model. */
  images: boolean;
  /** Extra system instructions, or the whole prompt when promptMode is replace. */
  systemPrompt: string;
  promptMode: PromptMode;
};

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  temperature: 0.8,
  maxOutputTokens: 8192,
  maxRounds: 4,
  selfReview: true,
  webResearch: true,
  images: true,
  systemPrompt: "",
  promptMode: "append",
};

const STORAGE_KEY = "kiln.model-settings.v1";
const MAX_PROMPT = 6000;

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function sanitizeModelSettings(input: unknown): ModelSettings {
  if (!input || typeof input !== "object") return { ...DEFAULT_MODEL_SETTINGS };
  const record = input as Record<string, unknown>;
  return {
    temperature: Math.round(clamp(record.temperature, 0, 1.5, DEFAULT_MODEL_SETTINGS.temperature) * 100) / 100,
    maxOutputTokens: Math.round(clamp(record.maxOutputTokens, 512, 16_384, DEFAULT_MODEL_SETTINGS.maxOutputTokens)),
    maxRounds: Math.round(clamp(record.maxRounds, 1, 6, DEFAULT_MODEL_SETTINGS.maxRounds)),
    selfReview: bool(record.selfReview, DEFAULT_MODEL_SETTINGS.selfReview),
    webResearch: bool(record.webResearch, DEFAULT_MODEL_SETTINGS.webResearch),
    images: bool(record.images, DEFAULT_MODEL_SETTINGS.images),
    systemPrompt:
      typeof record.systemPrompt === "string" ? record.systemPrompt.slice(0, MAX_PROMPT) : "",
    promptMode: record.promptMode === "replace" ? "replace" : "append",
  };
}

export function readModelSettings(): ModelSettings {
  if (typeof window === "undefined") return { ...DEFAULT_MODEL_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MODEL_SETTINGS };
    return sanitizeModelSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_MODEL_SETTINGS };
  }
}

export function writeModelSettings(next: ModelSettings): ModelSettings {
  const clean = sanitizeModelSettings(next);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Storage disabled: the settings still apply for this session.
  }
  return clean;
}

export function isDefaultSettings(settings: ModelSettings): boolean {
  return JSON.stringify(sanitizeModelSettings(settings)) === JSON.stringify(DEFAULT_MODEL_SETTINGS);
}

/** The system prompt a turn actually uses. */
export function composeSystemPrompt(base: string, settings: ModelSettings): string {
  const extra = settings.systemPrompt.trim();
  if (!extra) return base;
  if (settings.promptMode === "replace") return extra;
  return `${base}\n\n# Additional instructions from the user\nThese come from the model settings panel. They do not override the hard rules above, but follow them wherever they apply.\n\n${extra}`;
}
