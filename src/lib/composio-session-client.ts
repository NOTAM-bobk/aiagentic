"use client";

import type { SessionReport, SessionTool } from "./composio-session";

export type { SessionReport, SessionTool };

const keyFor = (userId: string) => `kiln.composio.session:${userId}`;

export function readSessionId(userId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(keyFor(userId));
  } catch {
    return null;
  }
}

function rememberSession(userId: string, sessionId: string): void {
  try {
    window.localStorage.setItem(keyFor(userId), sessionId);
  } catch {
    // Storage can be disabled; the session still works for this page load.
  }
}

/**
 * Ask the server for the current user's GitHub-only session. A stale saved id is
 * replaced by the route, so this is safe to call on every build.
 */
export async function loadSessionTools(userId: string): Promise<SessionReport | null> {
  try {
    const response = await fetch("/api/integrations/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, sessionId: readSessionId(userId) ?? undefined }),
      // Never hold up a build for more than a few seconds on connector setup.
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as SessionReport;
    if (!data?.sessionId || !Array.isArray(data.tools)) return null;
    rememberSession(userId, data.sessionId);
    return data;
  } catch {
    return null;
  }
}
