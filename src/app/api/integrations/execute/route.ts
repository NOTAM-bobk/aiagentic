import { NextResponse } from "next/server";
import { fail, handleError } from "@/lib/http";import { executeTool } from "@/lib/composio";
import { apiKey, requestApiKeys, withApiKeys } from "@/lib/keys-server";

export const maxDuration = 60;
export async function POST(request: Request) {
  return withApiKeys(requestApiKeys(request), () => run(request));
}

async function run(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      userId?: string;
      args?: Record<string, unknown>;
    };
    const action = (body.action ?? "").trim();
    const userId = (body.userId ?? "").trim().slice(0, 120);
    if (!action) return fail("Enter a Composio action slug, e.g. GITHUB_LIST_REPOSITORIES_FOR_A_USER.");
    if (!userId) return fail("Missing userId.");
    if (!apiKey("composio")) {
      return fail(
        "Add a Composio key in Setup (or COMPOSIO_API_KEY in the server env) to run connector actions.",
        503,
        "composio_missing",
      );
    }

    const args = body.args && typeof body.args === "object" ? body.args : {};
    const result = await executeTool(action, userId, args);
    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}
