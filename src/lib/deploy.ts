import { ApiError } from "./http";
import { apiKey } from "./keys-server";
import { sanitizePath } from "./protocol";

const API = "https://api.vercel.com";
export const BASE_DOMAIN = (process.env.BASE31_DOMAIN?.trim() || "base31.org").replace(/^\.+/, "");

/** Labels that would collide with infrastructure or common services. */
const RESERVED = new Set([
  "www",
  "api",
  "admin",
  "app",
  "mail",
  "smtp",
  "cdn",
  "docs",
  "status",
  "support",
  "deploy",
  "preview",
  "staging",
]);

const BINARY = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "avif", "ico", "bmp", "pdf", "zip", "gz", "tar",
  "mp3", "mp4", "mov", "webm", "woff", "woff2", "ttf", "otf", "eot", "wasm", "so", "exe",
]);

const MAX_FILES = 150;
const MAX_FILE_BYTES = 900_000;
const MAX_TOTAL_BYTES = 3_500_000;

function token(): string {
  const value = apiKey("vercel");
  if (!value) {
    throw new ApiError(
      "Deploys need a Vercel token. Add VERCEL_TOKEN in Setup (or the server env) and make sure base31.org is on that Vercel account.",
      503,
      "vercel_missing",
    );
  }
  return value;
}

function apiPath(path: string): string {
  const team = process.env.VERCEL_TEAM_ID?.trim();
  const joiner = path.includes("?") ? "&" : "?";
  return team ? `${path}${joiner}teamId=${encodeURIComponent(team)}` : path;
}

export function normalizeLabel(raw: string): string {
  const input = raw.trim().toLowerCase();
  // Accept a pasted host, or just the label before the base domain.
  const label = input
    .replace(new RegExp(`\\.?${BASE_DOMAIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  if (label.length < 3) {
    throw new ApiError("Pick a subdomain with at least 3 characters.", 400, "label_short");
  }
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(label)) {
    throw new ApiError("Use lowercase letters, numbers, and hyphens (not at the ends).", 400, "label_invalid");
  }
  if (RESERVED.has(label)) {
    throw new ApiError(`“${label}” is reserved. Pick another subdomain.`, 409, "label_reserved");
  }
  return label;
}

async function vercel(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API}${apiPath(path)}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: { message?: string } | string };
    if (typeof data.error === "string") return data.error;
    if (data.error?.message) return data.error.message;
  } catch {
    // fall through
  }
  return fallback;
}

export type DomainCheck = {
  label: string;
  host: string;
  url: string;
  available: boolean;
  reason?: string;
};

/** Ask Vercel which subdomains of the apex domain are already on a project. */
export async function checkSubdomain(raw: string): Promise<DomainCheck> {
  const label = normalizeLabel(raw);
  const host = `${label}.${BASE_DOMAIN}`;

  const response = await vercel(`/v1/domains/${encodeURIComponent(BASE_DOMAIN)}/project-domains?limit=100`);
  if (!response.ok) {
    if (response.status === 404) {
      throw new ApiError(
        `${BASE_DOMAIN} is not on this Vercel account. Add the domain to the same team as the token, then try again.`,
        409,
        "domain_missing",
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(
        `Vercel rejected that token, or it cannot access ${BASE_DOMAIN}. Check VERCEL_TOKEN and team access.`,
        409,
        "vercel_auth",
      );
    }
    throw new ApiError(
      await errorMessage(response, "Could not check that subdomain."),
      502,
      "deploy_check_failed",
    );
  }

  const data = (await response.json()) as {
    projectDomains?: { name?: string }[];
    pagination?: { next?: string | number | null };
  };
  const names = (data.projectDomains ?? []).map((domain) => (domain.name ?? "").toLowerCase());
  const taken = names.includes(host);

  return {
    label,
    host,
    url: `https://${host}`,
    available: !taken,
    reason: taken ? "That subdomain is already attached to a project." : undefined,
  };
}

function detectFramework(files: { path: string; content: string }[]): string | null {
  const pkg = files.find((file) => file.path === "package.json");
  if (!pkg) return null;
  try {
    const parsed = JSON.parse(pkg.content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...parsed.dependencies, ...parsed.devDependencies };
    if (deps.next) return "nextjs";
    if (deps.astro) return "astro";
    if (deps["@sveltejs/kit"]) return "sveltekit";
    if (deps.nuxt) return "nuxtjs";
    if (deps["@remix-run/dev"] || deps["@remix-run/react"]) return "remix";
    if (deps.vite) return "vite";
    if (deps.vue) return "vue";
    return null;
  } catch {
    return null;
  }
}

type VercelFile = { file: string; data: string; encoding: "base64" };

function deployableFiles(
  files: { path: string; content: string }[],
  images: { path: string; base64: string }[] = [],
): VercelFile[] {
  const output: VercelFile[] = [];
  let total = 0;
  for (const raw of files) {
    const path = sanitizePath(raw.path);
    if (!path) continue;
    if (path.split("/").some((part) => [".git", "node_modules", ".next", "dist", "build", "out"].includes(part))) {
      continue;
    }
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    if (BINARY.has(ext)) continue;
    const bytes = Buffer.byteLength(raw.content, "utf8");
    if (bytes > MAX_FILE_BYTES) continue;
    if (output.length >= MAX_FILES || total + bytes > MAX_TOTAL_BYTES) break;
    output.push({
      file: path,
      data: Buffer.from(raw.content, "utf8").toString("base64"),
      encoding: "base64",
    });
    total += bytes;
  }

  // Generated images are binary: send them as base64 next to the text files.
  for (const image of images) {
    const path = sanitizePath(image.path);
    if (!path || !BINARY.has(path.split(".").pop()?.toLowerCase() ?? "")) continue;
    const bytes = Math.ceil(image.base64.length * 0.75);
    if (bytes > MAX_FILE_BYTES || output.length >= MAX_FILES || total + bytes > MAX_TOTAL_BYTES) continue;
    output.push({ file: path, data: image.base64, encoding: "base64" });
    total += bytes;
  }

  return output;
}

export type DeployReport = {
  ok: boolean;
  label: string;
  host: string;
  url: string;
  state: string;
  deploymentId: string;
  deploymentUrl?: string;
  framework: string | null;
  files: number;
  warning?: string;
};

export async function deployProject(
  rawLabel: string,
  files: { path: string; content: string }[],
  images: { path: string; base64: string }[] = [],
): Promise<DeployReport> {
  const check = await checkSubdomain(rawLabel);
  const projectName = `base31-${check.label}`;
  // A project keeps one address. If the host is already attached to this
  // label's own project, this is a redeploy to the same URL, not a conflict.
  const redeploy = !check.available;
  if (redeploy) {
    const owned = await vercel(
      `/v9/projects/${encodeURIComponent(projectName)}/domains/${encodeURIComponent(check.host)}`,
    );
    if (!owned.ok) {
      throw new ApiError(check.reason ?? "That subdomain is already taken.", 409, "label_taken");
    }
  }
  if (files.length === 0) {
    throw new ApiError("Build the site first — there are no files to deploy.", 400, "deploy_empty");
  }

  const payload = deployableFiles(files, images);
  if (payload.length === 0) {
    throw new ApiError("None of the project files can be deployed (they are binary or too large).", 400);
  }

  const framework = detectFramework(files);

  const created = await vercel("/v13/deployments", {
    method: "POST",
    body: JSON.stringify({
      name: projectName,
      files: payload,
      target: "production",
      projectSettings: { framework },
    }),
  });

  if (!created.ok) {
    throw new ApiError(
      await errorMessage(created, "Vercel rejected the deployment."),
      created.status === 402 ? 402 : 502,
      "deploy_failed",
    );
  }

  const deployment = (await created.json()) as {
    id?: string;
    url?: string;
    readyState?: string;
    projectId?: string;
  };
  if (!deployment.id) {
    throw new ApiError("Vercel did not return a deployment id.", 502, "deploy_failed");
  }

  let warning: string | undefined;
  // A redeploy already owns the domain, so attaching it again would 409 and
  // look like a conflict. Only a first publish attaches the address.
  if (!redeploy) {
    const domain = await vercel(`/v10/projects/${encodeURIComponent(projectName)}/domains`, {
      method: "POST",
      body: JSON.stringify({ name: check.host }),
    });

    if (!domain.ok) {
      if (domain.status === 409) {
        // The domain list is paginated, so an existing project of ours can look
        // free. Re-check ownership before treating this as someone else's URL.
        const owned = await vercel(
          `/v9/projects/${encodeURIComponent(projectName)}/domains/${encodeURIComponent(check.host)}`,
        );
        if (!owned.ok) {
          throw new ApiError("That subdomain was claimed while deploying. Try another.", 409, "label_taken");
        }
      } else {
        const message = await errorMessage(domain, "Could not attach the domain.");
        if (!/already|exists/i.test(message)) {
          warning = `Deployment created, but the domain was not attached: ${message}`;
        }
      }
    } else {
      const attached = (await domain.json()) as { verified?: boolean };
      if (attached.verified === false) {
        warning = `The domain was attached but still needs verification in Vercel for ${check.host}.`;
      }
    }
  }

  let state = deployment.readyState ?? "QUEUED";
  for (let attempt = 0; attempt < 10 && state !== "READY" && state !== "ERROR" && state !== "CANCELED"; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 3500));
    const status = await vercel(`/v13/deployments/${encodeURIComponent(deployment.id)}`);
    if (!status.ok) break;
    const info = (await status.json()) as { readyState?: string; errorMessage?: string };
    state = info.readyState ?? state;
    if (info.errorMessage) warning = info.errorMessage;
  }

  return {
    ok: state === "READY",
    label: check.label,
    host: check.host,
    url: check.url,
    state,
    deploymentId: deployment.id,
    deploymentUrl: deployment.url ? `https://${deployment.url}` : undefined,
    framework,
    files: payload.length,
    warning:
      warning ??
      (state !== "READY"
        ? "Vercel is still building — the URL goes live when the build finishes."
        : undefined),
  };
}
