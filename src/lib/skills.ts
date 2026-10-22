export type Skill = { id: string; name: string; body: string };

const STORAGE_KEY = "kiln.skills.v1";
const MAX_SKILLS = 24;
const MAX_BODY = 6000;

/** Shipped with the workspace so a fresh project already builds to a high bar. */
export const DEFAULT_SKILLS: Skill[] = [
  {
    id: "default-design-variance",
    name: "design variance",
    body: "Every build starts from a different visual world. Derive palette, type, and composition from the subject, not from the previous project or from the editor's dark UI. Do not default to dark mode, green accents, or the same centered hero. Pick one of: oversized editorial type, full-bleed color field, asymmetric split, dense index, data grid, or image-led cover. Add one surprising detail that belongs to the subject.",
  },
  {
    id: "default-content-quality",
    name: "real content",
    body: "No lorem ipsum, placeholder headings, TODOs, or generic SaaS copy. Write specific names, prices, dates, and sentences that could only belong to this project. One h1 per page, semantic landmarks, labelled controls, alt text where images exist, and copy that reads like a human wrote it for this audience.",
  },
  {
    id: "default-framework-playbook",
    name: "framework playbook",
    body: "When the user names a framework, use it exactly. Include its real file layout, dependencies, and scripts. The dev script must bind 0.0.0.0 on port 3000 (vite --host 0.0.0.0 --port 3000, next dev -H 0.0.0.0 -p 3000, astro dev --host 0.0.0.0 --port 3000). Keep build output working with npm run build. Do not install packages by hand.",
  },
  {
    id: "default-verify-ship",
    name: "verify before done",
    body: "After a non-trivial change, check it: run the project's tests, typecheck, or build with <test> or <shell>, read the output, and fix the cause. Check the page at 360px, 768px, and 1440px widths mentally against the layout you wrote, ensure focus states and touch targets, and remove unused imports and console noise before finishing.",
  },
  {
    id: "default-mobile-first",
    name: "mobile layouts",
    body: "Design at 360px first, then widen. Every layout must survive a narrow screen: no horizontal scrolling, no fixed pixel widths that overflow, no controls under 40px tall, and no text over an image without a readable scrim. Nav and long lists collapse into a simple stacked form or a menu instead of shrinking to unreadable rows.",
  },
  {
    id: "default-accessibility",
    name: "accessible controls",
    body: "Semantic HTML before ARIA: real buttons, links, labels, and landmarks. Keep visible focus rings, a logical tab order, aria-labels on icon-only controls, and contrast that holds in both themes. Never put a click handler on a bare div, never hide content behind hover alone, and never trap keyboard focus in an overlay.",
  },
  {
    id: "default-motion",
    name: "restrained motion",
    body: "Use motion to explain a change, not to decorate it. Prefer short CSS transitions (120-220ms) on color, transform, and opacity; animate entrances once, never looping background movement, and respect prefers-reduced-motion. No parallax on mobile, no bounce on every hover, and no animation that blocks reading or delays interaction.",
  },
  {
    id: "default-self-contained",
    name: "self-contained assets",
    body: "The build must render with no network: generate artwork with CSS, inline SVG, or gradients, and use system font stacks unless the user asks for a hosted font. Avoid hotlinking stock photos or random CDN URLs; if an image is genuinely needed, reference a placeholder that always resolves or draw it. Never leave broken image icons or empty image boxes.",
  },
  {
    id: "default-states",
    name: "real states",
    body: "Every interactive surface needs its four states: default, hover/focus, loading, and empty or error. Forms validate, show inline messages, and keep typed input on failure. Lists show a designed empty state, async work shows a labelled spinner or skeleton, and failures say what happened and what to do next instead of silently doing nothing.",
  },
];

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
    if (!raw) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SKILLS));
      return DEFAULT_SKILLS;
    }
    return sanitizeSkills(JSON.parse(raw));
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
