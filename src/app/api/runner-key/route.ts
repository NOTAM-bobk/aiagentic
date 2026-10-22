import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { apiKey, requestApiKeys, withApiKeys } from "@/lib/keys-server";

/**
 * StackBlitz keys are applied in the browser (`configureAPIKey`), so the runner
 * needs the value at runtime. A key saved in Setup wins, then the server env.
 * Reading request headers keeps this dynamic and avoids baking the key into a
 * build artifact.
 */
export async function GET(request: Request) {
  await headers();
  return withApiKeys(requestApiKeys(request), () => {
    const key = apiKey("webcontainer") ?? process.env.STACKBLITZ_API_KEY?.trim() ?? "";
    return NextResponse.json({ key }, { headers: { "cache-control": "no-store" } });
  });
}
