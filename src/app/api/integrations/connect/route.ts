import { NextResponse } from "next/server";
import { fail, handleError } from "@/lib/http";
import { createConnectionLink } from "@/lib/composio";
import { requestApiKeys, withApiKeys } from "@/lib/keys-server";

export const maxDuration = 30;

export async function POST(request: Request) {
  return withApiKeys(requestApiKeys(request), () => run(request));
}

async function run(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      toolkit?: string;
      userId?: string;
      callbackUrl?: string;
    };
    const toolkit = (body.toolkit ?? "").trim();
    const userId = (body.userId ?? "").trim().slice(0, 120);
    if (!toolkit) return fail("Choose a toolkit to connect.");
    if (!userId) return fail("Missing userId.");

    const { redirectUrl } = await createConnectionLink(toolkit, userId, body.callbackUrl?.slice(0, 500));
    return NextResponse.json({ redirectUrl });
  } catch (error) {
    return handleError(error);
  }
}
