import { NextResponse } from "next/server";
import { fail, handleError } from "@/lib/http";
import { openGitHubSession } from "@/lib/composio-session";
import { requestApiKeys, withApiKeys } from "@/lib/keys-server";

export const maxDuration = 30;

export async function POST(request: Request) {
  return withApiKeys(requestApiKeys(request), () => run(request));
}

async function run(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      userId?: string;
      sessionId?: string;
    };
    const userId = (body.userId ?? "").trim().slice(0, 120);
    const sessionId = (body.sessionId ?? "").trim().slice(0, 120) || undefined;
    if (!userId) return fail("Missing userId.");

    const report = await openGitHubSession(userId, sessionId);
    return NextResponse.json(report);
  } catch (error) {
    return handleError(error);
  }
}
