import { NextResponse } from "next/server";
import { fail, handleError } from "@/lib/http";
import { FEATURED_TOOLKITS, listToolkits } from "@/lib/composio";

export const maxDuration = 30;

export async function GET(request: Request) {
  // Read the query outside the try block: during the build's prerender probe this
  // throws a Next.js bailout signal that must propagate, not become a logged 500.
  const userId = new URL(request.url).searchParams.get("userId")?.slice(0, 120);
  if (!userId) return fail("Missing userId.");

  try {
    if (!process.env.COMPOSIO_API_KEY) {
      return NextResponse.json({
        configured: false,
        toolkits: FEATURED_TOOLKITS.map((toolkit) => ({ ...toolkit, connected: false })),
      });
    }

    const toolkits = await listToolkits(userId);
    return NextResponse.json({ configured: true, toolkits });
  } catch (error) {
    return handleError(error);
  }
}
