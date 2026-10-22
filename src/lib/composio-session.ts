import { Composio } from "@composio/core";
import { ApiError } from "./http";
import { apiKey } from "./keys-server";

export type SessionTool = {
  slug: string;
  description: string;
  /** Top-level argument names, so the model knows the shape without a huge schema. */
  params: string[];
};

export type SessionReport = {
  sessionId: string;
  tools: SessionTool[];
  total: number;
  truncated: boolean;
};

const MAX_TOOLS = 120;

function client(): Composio {
  const key = apiKey("composio");
  if (!key) {
    throw new ApiError(
      "GitHub tools need a Composio key. Add COMPOSIO_API_KEY in Setup (or the server env).",
      503,
      "composio_missing",
    );
  }
  return new Composio({ apiKey: key });
}

function normalize(raw: unknown): SessionTool[] {
  const container = (raw ?? {}) as Record<string, unknown>;
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(container.tools)
      ? container.tools
      : [];
  const tools: SessionTool[] = [];
  for (const item of list.slice(0, MAX_TOOLS)) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const fn = (record.function && typeof record.function === "object"
      ? record.function
      : record) as Record<string, unknown>;
    const slug = typeof fn.name === "string" ? fn.name : typeof record.slug === "string" ? record.slug : "";
    if (!slug) continue;
    const description =
      typeof fn.description === "string" ? fn.description.replace(/\s+/g, " ").slice(0, 180) : "";
    const schema = fn.parameters && typeof fn.parameters === "object" ? fn.parameters : null;
    const properties =
      schema && (schema as Record<string, unknown>).properties && typeof (schema as Record<string, unknown>).properties === "object"
        ? Object.keys((schema as Record<string, unknown>).properties as Record<string, unknown>)
        : [];
    tools.push({ slug, description, params: properties.slice(0, 14) });
  }
  return tools;
}

/** Create (or resume) the current user's session with only the GitHub toolkit enabled. */
export async function openGitHubSession(userId: string, sessionId?: string): Promise<SessionReport> {
  const composio = client();
  let session;
  try {
    session = sessionId
      ? await composio.sessions.use(sessionId)
      : await composio.sessions.create(userId, { toolkits: ["github"] });
  } catch {
    // The saved session may belong to an old project or have been deleted.
    session = await composio.sessions.create(userId, { toolkits: ["github"] });
  }

  const raw = await session.tools();
  const everything = normalize(raw);
  return {
    sessionId: session.sessionId,
    tools: everything.slice(0, MAX_TOOLS),
    total: everything.length,
    truncated: everything.length >= MAX_TOOLS,
  };
}

/** Run one action inside the session, so identity and connections come from it. */
export async function executeSessionTool(
  sessionId: string,
  slug: string,
  args: Record<string, unknown>,
): Promise<{ ok: boolean; summary: string; raw: unknown }> {
  const composio = client();
  const session = await composio.sessions.use(sessionId);
  const result = await session.execute(slug, args);
  const record = (result ?? {}) as Record<string, unknown>;
  const failed = record.successful === false || record.error != null;
  const data = record.data ?? record.result ?? record.response ?? record;
  const summary = JSON.stringify(data, null, 2).slice(0, 4000);
  return { ok: !failed, summary, raw: data };
}
