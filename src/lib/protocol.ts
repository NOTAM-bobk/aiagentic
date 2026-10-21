export type Plan = {
  title: string;
  concept: string;
  audience?: string;
  artDirection?: {
    palette?: string;
    typography?: string;
    layout?: string;
    motion?: string;
  };
  sections?: string[];
  files?: { path: string; purpose: string }[];
  buildSteps?: { title: string; detail: string }[];
  needsSearch?: boolean;
  searchQueries?: string[];
  risks?: string[];
};

export type FileArtifact = { kind: "file"; path: string; content: string };
export type SearchArtifact = { kind: "search"; query: string };
export type ShellArtifact = { kind: "shell"; command: string };
export type ConnectArtifact = { kind: "connect"; toolkit: string; note: string };
export type ActionArtifact = { kind: "action"; tool: string; args: string };
export type DeleteArtifact = { kind: "delete"; path: string };
export type DoneArtifact = { kind: "done"; summary: string };

export type Artifact =
  | FileArtifact
  | SearchArtifact
  | ShellArtifact
  | ConnectArtifact
  | ActionArtifact
  | DeleteArtifact
  | DoneArtifact;

export type ToolEvent = {
  id: string;
  kind: "plan" | "search" | "write" | "shell" | "connect" | "delete" | "sandbox";
  label: string;
  detail?: string;
  status: "pending" | "running" | "ok" | "error";
  output?: string;
  meta?: Record<string, unknown>;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  raw?: string;
  plan?: Plan | null;
  tools?: ToolEvent[];
  pending?: boolean;
  error?: string;
  createdAt: number;
};

export type ProjectFile = { path: string; content: string };

export type WorkspaceMode = "cloud" | "local";

export type Project = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  files: ProjectFile[];
  sandboxId?: string | null;
  mode: WorkspaceMode;
  builder: string;
  /** Model id for Puter builds. Empty means Puter's current default. */
  puterModel?: string;
  previewUrl?: string | null;
};

const TAG = /<\s*(file|say|search|shell|connect|action|delete|done)\b([^>]*)>([\s\S]*?)<\s*\/\s*\1\s*>/gi;

function attr(attrs: string, name: string): string {
  // Accept single or double quotes: models occasionally switch.
  const match = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(attrs);
  return (match?.[2] ?? match?.[3] ?? "").trim();
}

/**
 * Extract tool invocations from a builder response. Tolerant of markdown fences
 * that models like to wrap around their blocks.
 */
export function parseArtifacts(raw: string): Artifact[] {
  const artifacts: Artifact[] = [];
  // Remove standalone fence lines that models wrap around whole responses, but
  // keep fenced code that legitimately belongs inside a file's content.
  const source = raw.replace(/^\s*```[a-zA-Z]*\s*$/gm, "");

  for (const match of source.matchAll(TAG)) {
    const tag = match[1].toLowerCase();
    const attrs = match[2] ?? "";
    const body = match[3] ?? "";

    if (tag === "file") {
      const path = sanitizePath(attr(attrs, "path"));
      if (path) artifacts.push({ kind: "file", path, content: body.replace(/^\n/, "").replace(/\s+$/, "") + "\n" });
    } else if (tag === "search") {
      const query = body.trim();
      if (query) artifacts.push({ kind: "search", query });
    } else if (tag === "shell") {
      const command = body.trim();
      if (command) artifacts.push({ kind: "shell", command });
    } else if (tag === "connect") {
      const toolkit = attr(attrs, "toolkit").toLowerCase();
      if (toolkit) artifacts.push({ kind: "connect", toolkit, note: body.trim() });
    } else if (tag === "action") {
      const tool = attr(attrs, "tool").toUpperCase().replace(/[^A-Z0-9_]/g, "");
      if (tool) artifacts.push({ kind: "action", tool, args: body.trim() || "{}" });
    } else if (tag === "delete") {
      const path = sanitizePath(attr(attrs, "path"));
      if (path) artifacts.push({ kind: "delete", path });
    } else if (tag === "done") {
      artifacts.push({ kind: "done", summary: body.trim() });
    }
  }

  return artifacts;
}

export function sanitizePath(value: string): string {
  const cleaned = value.replace(/\\/g, "/").replace(/^\/+/, "").replace(/^(\.\/)+/, "").replace(/\.\.(\/|$)/g, "");
  if (!cleaned || cleaned.endsWith("/")) return "";
  return cleaned.slice(0, 200);
}

/** Short status text to show while a response is still streaming. */
export function streamPreview(raw: string): string {
  const say = /<say>([\s\S]*?)(?:<\/say>|$)/i.exec(raw)?.[1]?.trim();
  if (say) return say;
  const stripped = raw
    .replace(/<file\b[^>]*>[\s\S]*$/i, "")
    .replace(/<[^>]+>/g, "")
    .trim();
  return stripped.slice(0, 280);
}

export function filePathsFromRaw(raw: string): string[] {
  return [...raw.matchAll(/<file\s+path\s*=\s*"([^"]+)"/gi)].map((match) => match[1]);
}

export const STARTER_PROMPTS = [
  "A portfolio for a ceramicist in Oaxaca, warm and tactile, with a gallery and workshop dates.",
  "Landing page for a small batch coffee roaster. Editorial type, subscription CTA, tasting notes.",
  "A one-page site for a mountain cabin rental. Big photography, booking CTA, seasonal rates.",
  "Docs-style homepage for an open source tool that turns SQL into charts.",
];
