import { NextResponse } from "next/server";
import { fail, handleError } from "@/lib/http";
import { formatSearchForModel, tavilySearch } from "@/lib/tavily";

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { query?: string };
    const query = (body.query ?? "").trim().slice(0, 400);
    if (!query) return fail("Missing search query.");

    const result = await tavilySearch(query);
    return NextResponse.json({
      ...result,
      summary: formatSearchForModel(result),
    });
  } catch (error) {
    return handleError(error);
  }
}
