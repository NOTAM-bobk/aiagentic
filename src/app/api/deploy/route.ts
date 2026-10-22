import { NextResponse } from "next/server";
import { deployProject } from "@/lib/deploy";
import { fail, handleError } from "@/lib/http";
import { requestApiKeys, withApiKeys } from "@/lib/keys-server";
import { sanitizePath } from "@/lib/protocol";

export const maxDuration = 60;

type Body = {
  name?: string;
  files?: { path: string; content: string }[];
};

export async function POST(request: Request) {
  return withApiKeys(requestApiKeys(request), () => run(request));
}

async function run(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const name = (body.name ?? "").trim().slice(0, 120);
    if (!name) return fail("Choose a subdomain first.", 400, "label_missing");

    const files = (body.files ?? [])
      .map((file) => ({ path: sanitizePath(file.path), content: String(file.content ?? "") }))
      .filter((file) => file.path && file.content.length <= 1_000_000)
      .slice(0, 160);

    const report = await deployProject(name, files);
    return NextResponse.json(report);
  } catch (error) {
    return handleError(error);
  }
}
