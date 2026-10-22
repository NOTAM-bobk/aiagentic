import { NextResponse } from "next/server";
import { checkSubdomain } from "@/lib/deploy";
import { handleError } from "@/lib/http";
import { requestApiKeys, withApiKeys } from "@/lib/keys-server";

export const maxDuration = 30;

export async function GET(request: Request) {
  return withApiKeys(requestApiKeys(request), () => run(request));
}

async function run(request: Request) {
  try {
    const name = new URL(request.url).searchParams.get("name") ?? "";
    const result = await checkSubdomain(name);
    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}
