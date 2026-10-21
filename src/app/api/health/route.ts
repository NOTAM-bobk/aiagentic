import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { BUILDERS, PLANNER_MODEL, readCapabilities } from "@/lib/models";

export async function GET() {
  // Reading request data opts the handler into dynamic rendering, so `process.env`
  // is evaluated per request rather than baked in at build time.
  await headers();
  const capabilities = readCapabilities();
  return NextResponse.json({
    capabilities,
    models: {
      planner: PLANNER_MODEL,
      builders: BUILDERS,
    },
    ready: capabilities.groq || capabilities.google || capabilities.puter,
  });
}
