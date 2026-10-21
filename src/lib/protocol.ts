export type Plan = {
  title: string;
  concept: string;
  audience?: string;
  stack?: string;
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
export type ThinkArtifact = { kind: "think"; text: string };
export type AskArtifact = { kind: "ask"; question: string; options: string[] };
export type RunArtifact = { kind: "run"; command: string };
export type TitleArtifact = { kind: "title"; title: string };

export type Artifact =
  | FileArtifact
  | SearchArtifact
  | ShellArtifact
  | ConnectArtifact
  | ActionArtifact
  | DeleteArtifact
  | DoneArtifact
  | ThinkArtifact
  | AskArtifact
  | RunArtifact
  | TitleArtifact;

export type ToolEvent = {
  id: string;
  kind: "plan" | "search" | "write" | "shell" | "run" | "connect" | "delete" | "sandbox";
  label: string;
  detail?: string;
  status: "pending" | "running" | "ok" | "error";
  output?: string;
  meta?: Record<string, unknown>;
};

export type Question = { text: string; options: string[] };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  raw?: string;
  plan?: Plan | null;
  tools?: ToolEvent[];
  pending?: boolean;
  error?: string;
  /** Reasoning the model shared before acting, shown in a collapsible block. */
  thinking?: string;
  /** A question back to the user, with optional clickable answers. */
  question?: Question | null;
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
  /** Long-running server the agent asked for, e.g. `python3 app.py`. */
  runCommand?: string | null;
  /** Short label for how the preview is being served: static, vite dev, node. */
  runtime?: string | null;
};

const TAG =
  /<\s*(file|say|search|shell|connect|action|delete|done|think|ask|run|title)\b([^>]*)>([\s\S]*?)<\s*\/\s*\1\s*>/gi;

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
    } else if (tag === "run") {
      const command = body.trim();
      if (command) artifacts.push({ kind: "run", command });
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
    } else if (tag === "think") {
      const text = body.trim();
      if (text) artifacts.push({ kind: "think", text });
    } else if (tag === "ask") {
      const question = body.trim();
      const options = attr(attrs, "options")
        .split("|")
        .map((option) => option.trim())
        .filter(Boolean)
        .slice(0, 4);
      if (question) artifacts.push({ kind: "ask", question, options });
    } else if (tag === "title") {
      const title = body.trim().replace(/^["'“”]+|["'“”]+$/g, "").slice(0, 64);
      if (title) artifacts.push({ kind: "title", title });
    }
  }

  return artifacts;
}

export function sanitizePath(value: string): string {
  const cleaned = value.replace(/\\/g, "/").replace(/^\/+/, "").replace(/^(\.\/)+/, "").replace(/\.\.(\/|$)/g, "");
  if (!cleaned || cleaned.endsWith("/")) return "";
  return cleaned.slice(0, 200);
}

/** Reasoning streamed so far, even before the closing tag arrives. */
export function streamThink(raw: string): string {
  const matches = [...raw.matchAll(/<think>([\s\S]*?)(?:<\/think>|$)/gi)];
  const latest = matches.at(-1)?.[1]?.trim() ?? "";
  return latest.slice(-1800);
}

/** The `<say>` status line, or a short guess while no say block exists yet. */
export function streamPreview(raw: string): string {
  const say = /<say>([\s\S]*?)(?:<\/say>|$)/i.exec(raw)?.[1]?.trim();
  if (say) return say;
  if (/<think>[\s\S]*$/i.test(raw)) return "";
  if (/<file\b/i.test(raw)) return "";
  const stripped = raw
    .replace(/<[^>]+>/g, "")
    .trim();
  return stripped.slice(0, 280);
}

/** One short line describing the step in flight, e.g. "writing src/App.jsx". */
export function currentActivity(raw: string): string {
  if (/<file\s+path\s*=\s*["'][^"']+["'][^>]*>(?:(?!<\/file>)[\s\S])*$/i.test(raw)) {
    const path = /<file\s+path\s*=\s*["']([^"']+)["'][^>]*>(?:(?!<\/file>)[\s\S])*$/i.exec(raw)?.[1];
    return path ? `writing ${path}` : "writing files";
  }
  if (/<think>(?:(?!<\/think>)[\s\S])*$/i.test(raw)) return "thinking";
  if (/<shell>(?:(?!<\/shell>)[\s\S])*$/i.test(raw)) return "running a command";
  if (/<run>(?:(?!<\/run>)[\s\S])*$/i.test(raw)) return "starting a server";
  if (/<search>(?:(?!<\/search>)[\s\S])*$/i.test(raw)) return "searching";
  if (/<ask>(?:(?!<\/ask>)[\s\S])*$/i.test(raw)) return "writing a question";
  if (/<file\b/i.test(raw)) return "writing files";
  return "thinking";
}

export function filePathsFromRaw(raw: string): string[] {
  return [...raw.matchAll(/<file\s+path\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]);
}
