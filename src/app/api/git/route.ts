import { NextResponse } from "next/server";
import { fail, handleError } from "@/lib/http";
import { hasGitHub, pushProject } from "@/lib/github";
import { sanitizePath } from "@/lib/protocol";
import { requestApiKeys, withApiKeys } from "@/lib/keys-server";

export const maxDuration = 60;

type Body = {
  files?: { path: string; content: string }[];
  repo?: string;
  branch?: string;
  message?: string;
  isPrivate?: boolean;
};

export async function GET(request: Request) {
  return withApiKeys(requestApiKeys(request), () =>
    NextResponse.json({ configured: hasGitHub() }),
  );
}

export async function POST(request: Request) {
  return withApiKeys(requestApiKeys(request), () => run(request));
}

async function run(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const files = (body.files ?? [])
      .map((file) => ({ path: sanitizePath(file.path), content: String(file.content ?? "") }))
      .filter((file) => file.path && file.content.length <= 400_000)
      .slice(0, 80);

    if (files.length === 0) return fail("There are no files to push yet.", 400, "git_empty");
    if (!body.repo?.trim()) return fail("Which repository should this go to?", 400, "repo_missing");

    const report = await pushProject({
      files,
      repo: body.repo,
      branch: body.branch,
      message: body.message,
      isPrivate: body.isPrivate,
    });

    return NextResponse.json(report);
  } catch (error) {
    return handleError(error);
  }
}
