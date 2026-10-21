import { NextResponse } from "next/server";
import { fail, handleError } from "@/lib/http";
import { executeTool } from "@/lib/composio";

export const maxDuration = 60;

export async function POST(request: Request) {
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
    if (!process.env.COMPOSIO_API_KEY) {
      return fail(
        "Add COMPOSIO_API_KEY in Vercel → Settings → Environment Variables to run connector actions.",
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
