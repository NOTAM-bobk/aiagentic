import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { BUILDERS, PLANNER_MODEL, readCapabilities } from "@/lib/models";
import { requestApiKeys, withApiKeys } from "@/lib/keys-server";

export async function GET(request: Request) {
  // Reading request data opts the handler into dynamic rendering, so keys are
  // evaluated per request rather than baked in at build time.
  await headers();
  return withApiKeys(requestApiKeys(request), () => {
    const capabilities = readCapabilities();
    return NextResponse.json({
      capabilities,
      models: {
        planner: PLANNER_MODEL,
        builders: BUILDERS,
      },
      ready: capabilities.groq || capabilities.google || capabilities.puter,
    });
  });
}
