import { Octokit } from "octokit";
import git from "isomorphic-git";
import http from "isomorphic-git/http/node";
import { Volume } from "memfs";
import { ApiError } from "./http";
import { apiKey } from "./keys-server";

const TOKEN_PARTS = ["GITHUB_API_TOKEN", "GITHUB_PERSONAL_ACCESS_TOKEN"] as const;

function token(): string | undefined {
  const direct = apiKey("github") ?? process.env.GITHUB_API_TOKEN ?? process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
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

export type RepoSummary = {
  fullName: string;
  name: string;
  owner: string;
  defaultBranch: string;
  private: boolean;
  updatedAt: string;
};

export async function listRepos(): Promise<RepoSummary[]> {
  const auth = token();
  if (!auth) {
    throw new ApiError(
      "Repository listing needs a GitHub token. Add GITHUB_TOKEN in Setup to browse and clone your repos.",
      503,
      "github_missing",
    );
  }

  try {
    const octokit = new Octokit({ auth });
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      per_page: 60,
      sort: "updated",
      affiliation: "owner,collaborator,organization_member",
    });
    return data.map((repo) => ({
      fullName: repo.full_name,
      name: repo.name,
      owner: repo.owner?.login ?? repo.full_name.split("/")[0],
      defaultBranch: repo.default_branch || "main",
      private: Boolean(repo.private),
      updatedAt: repo.updated_at ?? "",
    }));
  } catch (error) {
    const status = statusOf(error);
    if (status === 401 || status === 403) {
      throw new ApiError(
        "GitHub rejected that token. Sign in again in Setup with a token that can read repositories.",
        502,
        "github_auth",
      );
    }
    throw new ApiError(
      `Could not list repositories: ${error instanceof Error ? error.message : "unknown error"}`,
      502,
      "github_failed",
    );
  }
}

export type RepoCloneReport = {
  repo: string;
  branch: string;
  files: { path: string; content: string }[];
  skipped: number;
};

const SKIP_DIRS = new Set([".git", "node_modules", "dist", "build", ".next", "out", "vendor", ".cache"]);
const BINARY_EXT = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "avif", "ico", "bmp", "pdf", "zip", "gz", "tar", "mp3", "mp4",
  "mov", "webm", "woff", "woff2", "ttf", "otf", "eot", "wasm", "so", "dylib", "exe", "bin", "lockb",
]);
const MAX_FILE_BYTES = 300_000;
const MAX_FILES = 140;
const MAX_TOTAL_BYTES = 1_600_000;

function parseRepo(value: string): { owner: string; name: string } {
  const cleaned = value
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/^git@github\.com:/i, "")
    .replace(/\.git$/i, "")
    .replace(/\/+$/, "");
  const [owner, name] = cleaned.split("/");
  if (!owner || !name || !/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(name)) {
    throw new ApiError("That GitHub repository is not valid. Use owner/name.", 400, "repo_invalid");
  }
  return { owner, name };
}

/**
 * Clone a repository with isomorphic-git into an in-memory volume, then return
 * the readable text files so the editor can adopt them as project files.
 */
export async function cloneRepo(input: { repo: string; branch?: string }): Promise<RepoCloneReport> {
  const { owner, name } = parseRepo(input.repo);
  const auth = token();
  const volume = new Volume();
  const fs = volume as unknown as Parameters<typeof git.clone>[0]["fs"];
  const dir = "/repo";

  try {
    await git.clone({
      fs,
      http,
      dir,
      url: `https://github.com/${owner}/${name}.git`,
      ref: input.branch || undefined,
      singleBranch: Boolean(input.branch),
      depth: 1,
      onAuth: auth
        ? () => ({ username: "x-access-token", password: auth })
        : undefined,
    });
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode ?? statusOf(error);
    if (status === 401 || status === 403 || status === 404) {
      throw new ApiError(
        auth
          ? `GitHub could not open ${owner}/${name}. Check that the token can read that repository.`
          : `That repository is private or missing. Sign in with a GitHub token in Setup, then try again.`,
        401,
        "github_auth",
      );
    }
    throw new ApiError(
      `Clone failed: ${error instanceof Error ? error.message : "unknown error"}`,
      502,
      "git_clone_failed",
    );
  }

  const branch =
    (await git.currentBranch({ fs, dir, fullname: false })) || input.branch || "main";
  const files: { path: string; content: string }[] = [];
  let skipped = 0;
  let total = 0;

  const walk = (relative: string) => {
    let names: string[] = [];
    try {
      names = volume.readdirSync(`${dir}${relative ? `/${relative}` : ""}`) as string[];
    } catch {
      return;
    }
    for (const entry of names.sort()) {
      const next = relative ? `${relative}/${entry}` : entry;
      if (SKIP_DIRS.has(entry)) {
        skipped += 1;
        continue;
      }
      const absolute = `${dir}/${next}`;
      let stat;
      try {
        stat = volume.statSync(absolute);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        walk(next);
        continue;
      }
      const ext = entry.split(".").pop()?.toLowerCase() ?? "";
      if (BINARY_EXT.has(ext) || stat.size > MAX_FILE_BYTES) {
        skipped += 1;
        continue;
      }
      if (files.length >= MAX_FILES || total + stat.size > MAX_TOTAL_BYTES) {
        skipped += 1;
        continue;
      }
      const content = volume.readFileSync(absolute, "utf8") as string;
      if (content.includes("\u0000")) {
        skipped += 1;
        continue;
      }
      files.push({ path: next, content });
      total += stat.size;
    }
  };

  walk("");
  if (files.length === 0) {
    throw new ApiError("That repository has no readable files to import.", 400, "git_empty");
  }

  return { repo: `${owner}/${name}`, branch, files, skipped };
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
      "Git push needs a GitHub token. Add GITHUB_TOKEN in Setup (or the server env), or connect GitHub in Connectors and let the agent use a connector action.",
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
