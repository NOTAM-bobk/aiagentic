import { NextResponse } from "next/server";
import { headers } from "next/headers";

/**
 * StackBlitz keys are applied in the browser (`configureAPIKey`), so the runner
 * needs the value at runtime. Reading request headers keeps this dynamic and
 * avoids baking the key into a build artifact.
 */
export async function GET() {
  await headers();
  const key =
    process.env.WEBCONTAINER_API_KEY?.trim() || process.env.STACKBLITZ_API_KEY?.trim() || "";
  return NextResponse.json({ key }, { headers: { "cache-control": "no-store" } });
}
