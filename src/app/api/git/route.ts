import { NextResponse } from "next/server";
import { fail, handleError } from "@/lib/http";
import { cloneRepo, hasGitHub, listRepos, pushProject } from "@/lib/github";
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
  return withApiKeys(requestApiKeys(request), () => read(request));
}

async function read(request: Request) {
  const params = new URL(request.url).searchParams;
  const action = params.get("action") ?? "status";

  try {
    if (action === "repos") {
      if (!hasGitHub()) {
        return fail("Sign in with a GitHub token in Setup to list your repositories.", 401, "github_missing");
      }
      const repos = await listRepos();
      return NextResponse.json({ configured: true, repos });
    }

    if (action === "clone") {
      const repo = (params.get("repo") ?? "").trim().slice(0, 200);
      const branch = (params.get("branch") ?? "").trim().slice(0, 120) || undefined;
      if (!repo) return fail("Choose a repository to import.", 400, "repo_missing");
      const report = await cloneRepo({ repo, branch });
      return NextResponse.json(report);
    }

    return NextResponse.json({ configured: hasGitHub() });
  } catch (error) {
    return handleError(error);
  }
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
