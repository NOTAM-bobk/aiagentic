import { Octokit } from "octokit";
import { ApiError } from "./http";

const TOKEN_PARTS = ["GITHUB_API_TOKEN", "GITHUB_PERSONAL_ACCESS_TOKEN"] as const;

function token(): string | undefined {
  const direct = process.env.GITHUB_TOKEN ?? process.env.GITHUB_API_TOKEN ?? process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (direct) return direct;
  // Some environments prefix secrets by hand; tolerate a stray space.
  for (const key of TOKEN_PARTS) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function hasGitHub(): boolean {
  return Boolean(token());
}

export type GitPushReport = {
  repo: string;
  url: string;
  commitUrl: string;
  branch: string;
};

function cleanRepo(value: string): string {
  const repo = value
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "")
    .split("/")
    .pop()
    ?.replace(/[^A-Za-z0-9_.-]/g, "")
    .slice(0, 100);
  if (!repo) throw new ApiError("That repository name is not valid.", 400, "repo_invalid");
  return repo;
}

function cleanBranch(value: string): string {
  const branch = (value || "main").replace(/[^A-Za-z0-9_./-]/g, "").slice(0, 120);
  if (!branch) throw new ApiError("That branch name is not valid.", 400, "branch_invalid");
  return branch;
}

function statusOf(error: unknown): number | undefined {
  const candidate = error as { status?: number };
  return typeof candidate?.status === "number" ? candidate.status : undefined;
}

/**
 * Create the repository if needed, then push every file as one commit on
 * `branch` using the Git Data API (blobs → tree → commit → ref).
 */
export async function pushProject(input: {
  files: { path: string; content: string }[];
  repo: string;
  branch?: string;
  message?: string;
  isPrivate?: boolean;
}): Promise<GitPushReport> {
  const auth = token();
  if (!auth) {
    throw new ApiError(
      "Git push needs a GitHub token. Add GITHUB_TOKEN in Settings → Environment, or connect GitHub in Connectors and let the agent use a connector action.",
      503,
      "github_missing",
    );
  }

  const files = input.files.filter((file) => file.path && file.content.length <= 400_000).slice(0, 80);
  if (files.length === 0) throw new ApiError("There are no files to push yet.", 400, "git_empty");

  const name = cleanRepo(input.repo);
  const branch = cleanBranch(input.branch ?? "main");
  const message = (input.message ?? "Update from Kiln").slice(0, 240) || "Update from Kiln";
  const octokit = new Octokit({ auth });

  try {
    const { data: user } = await octokit.rest.users.getAuthenticated();
    const owner = user.login;

    let repository;
    try {
      repository = (await octokit.rest.repos.get({ owner, repo: name })).data;
    } catch (error) {
      if (statusOf(error) !== 404) throw error;
      repository = (
        await octokit.rest.repos.createForAuthenticatedUser({
          name,
          private: input.isPrivate ?? true,
          auto_init: true,
          description: "Built with Kiln",
        })
      ).data;
    }

    const defaultBranch = repository.default_branch || "main";
    const baseRef = await octokit.rest.git.getRef({ owner, repo: name, ref: `heads/${defaultBranch}` });

    let headSha = baseRef.data.object.sha;
    if (branch !== defaultBranch) {
      try {
        const existing = await octokit.rest.git.getRef({ owner, repo: name, ref: `heads/${branch}` });
        headSha = existing.data.object.sha;
      } catch (error) {
        if (statusOf(error) !== 404) throw error;
        await octokit.rest.git.createRef({ owner, repo: name, ref: `refs/heads/${branch}`, sha: headSha });
      }
    }

    const baseCommit = await octokit.rest.git.getCommit({ owner, repo: name, commit_sha: headSha });
    const blobs = await Promise.all(
      files.map(async (file) => {
        const blob = await octokit.rest.git.createBlob({
          owner,
          repo: name,
          content: Buffer.from(file.content, "utf8").toString("base64"),
          encoding: "base64",
        });
        return { path: file.path, mode: "100644" as const, type: "blob" as const, sha: blob.data.sha };
      }),
    );

    const tree = await octokit.rest.git.createTree({
      owner,
      repo: name,
      base_tree: baseCommit.data.tree.sha,
      tree: blobs,
    });
    const commit = await octokit.rest.git.createCommit({
      owner,
      repo: name,
      message,
      tree: tree.data.sha,
      parents: [headSha],
    });
    await octokit.rest.git.updateRef({ owner, repo: name, ref: `heads/${branch}`, sha: commit.data.sha });

    return {
      repo: `${owner}/${name}`,
      url: repository.html_url,
      commitUrl: commit.data.html_url,
      branch,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const status = statusOf(error);
    if (status === 401 || status === 403) {
      throw new ApiError(
        "GitHub rejected that token. Check GITHUB_TOKEN and that it can create repositories.",
        502,
        "github_auth",
      );
    }
    throw new ApiError(
      `GitHub push failed: ${error instanceof Error ? error.message : "unknown error"}`,
      502,
      "github_failed",
    );
  }
}
