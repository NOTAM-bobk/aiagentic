export type Skill = { id: string; name: string; body: string };

const STORAGE_KEY = "kiln.skills.v1";
const MAX_SKILLS = 24;
const MAX_BODY = 6000;

/** Accept only well-formed skills coming from the client or storage. */
export function sanitizeSkills(input: unknown): Skill[] {
  if (!Array.isArray(input)) return [];
  const output: Skill[] = [];
  for (const item of input.slice(0, MAX_SKILLS)) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim().slice(0, 80) : "";
    const body = typeof record.body === "string" ? record.body.trim().slice(0, MAX_BODY) : "";
    if (!name || !body) continue;
    output.push({
      id: typeof record.id === "string" && record.id ? record.id.slice(0, 60) : `skill_${output.length}`,
      name,
      body,
    });
  }
  return output;
}

export function readSkills(): Skill[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeSkills(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function writeSkills(skills: Skill[]): void {
  try {
    const clean = sanitizeSkills(skills);
    if (clean.length === 0) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Storage can be disabled; skills still apply for this session.
  }
}
