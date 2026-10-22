import { ApiError } from "./http";
import { apiKey } from "./keys-server";

const BASES = ["https://backend.composio.dev/api/v3.1", "https://backend.composio.dev/api/v3"];

export const FEATURED_TOOLKITS = [
  { slug: "github", name: "GitHub", blurb: "Repos, commits, issues, pull requests" },
  { slug: "supabase", name: "Supabase", blurb: "Postgres, auth, storage" },
  { slug: "cloudflare", name: "Cloudflare", blurb: "DNS, workers, pages" },
  { slug: "vercel", name: "Vercel", blurb: "Projects, deployments, domains" },
  { slug: "notion", name: "Notion", blurb: "Docs, databases, content" },
  { slug: "slack", name: "Slack", blurb: "Channels, messages, files" },
  { slug: "linear", name: "Linear", blurb: "Issues, projects, cycles" },
  { slug: "stripe", name: "Stripe", blurb: "Payments, products, invoices" },
];

export type Toolkit = {
  slug: string;
  name: string;
  blurb?: string;
  connected: boolean;
  accountId?: string;
  status?: string;
  /** Brand mark hosted by Composio, when the catalog provides one. */
  logo?: string;
};

type Json = Record<string, unknown>;

async function composioFetch(path: string, init?: RequestInit): Promise<Json> {
  const key = apiKey("composio");
  if (!key) {
    throw new ApiError(
      "Connectors need a Composio key. Add COMPOSIO_API_KEY in Setup (or the server env) to link GitHub, Supabase, Cloudflare and more.",
      503,
      "composio_missing",
    );
  }

  let lastError: unknown;
  for (const base of BASES) {
    try {
      const response = await fetch(`${base}${path}`, {
        ...init,
        headers: {
          "x-api-key": key,
          "content-type": "application/json",
          ...(init?.headers ?? {}),
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (response.status === 404) {
        lastError = new Error(`Composio endpoint ${path} was not found`);
        continue;
      }
      const text = await response.text();
      const data = text ? (JSON.parse(text) as Json) : {};
      if (!response.ok) {
        const message =
          typeof data.error === "string"
            ? data.error
            : typeof data.message === "string"
              ? data.message
              : text.slice(0, 240);
        throw new ApiError(`Composio error (${response.status}): ${message}`, 502, "composio_failed");
      }
      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      lastError = error;
    }
  }

  throw new ApiError(
    `Could not reach Composio: ${lastError instanceof Error ? lastError.message : "unknown error"}`,
    502,
    "composio_unreachable",
  );
}

function items(data: Json): Json[] {
  const candidates = [data.items, data.data, data.results, data.toolkits, data.connected_accounts];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as Json[];
  }
  return [];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function toolkitSlugOf(item: Json): string | undefined {
  if (typeof item.toolkit === "string") return item.toolkit;
  if (item.toolkit && typeof item.toolkit === "object") {
    const nested = item.toolkit as Json;
    return asString(nested.slug) ?? asString(nested.name)?.toLowerCase();
  }
  return asString(item.toolkit_slug) ?? asString(item.slug);
}

export async function listToolkits(userId: string): Promise<Toolkit[]> {
  const [catalog, accounts] = await Promise.all([
    composioFetch("/toolkits?limit=80").catch(() => ({}) as Json),
    composioFetch(`/connected_accounts?user_ids=${encodeURIComponent(userId)}&limit=100`).catch(
      () => ({}) as Json,
    ),
  ]);

  const connectedMap = new Map<string, { id?: string; status?: string }>();
  for (const account of items(accounts)) {
    const slug = toolkitSlugOf(account);
    if (!slug) continue;
    if (asString(account.status) === "INITIALIZING") continue;
    connectedMap.set(slug, { id: asString(account.id), status: asString(account.status) });
  }

  const bySlug = new Map<string, Toolkit>();
  for (const featured of FEATURED_TOOLKITS) {
    const connection = connectedMap.get(featured.slug);
    bySlug.set(featured.slug, {
      ...featured,
      connected: Boolean(connection),
      accountId: connection?.id,
      status: connection?.status ?? (connection ? "ACTIVE" : undefined),
    });
  }

  for (const item of items(catalog)) {
    const slug = asString(item.slug) ?? asString(item.key);
    if (!slug || bySlug.has(slug)) continue;
    const connection = connectedMap.get(slug);
    const meta = (item.meta ?? {}) as Json;
    bySlug.set(slug, {
      slug,
      name: asString(item.name) ?? slug,
      blurb: asString(item.description) ?? asString(meta.description),
      connected: Boolean(connection),
      accountId: connection?.id,
      status: connection?.status,
      logo: asString(item.logo) ?? asString(meta.logo) ?? asString(item.logo_url),
    });
  }

  return [...bySlug.values()].sort((a, b) => {
    if (a.connected !== b.connected) return a.connected ? -1 : 1;
    const featuredA = FEATURED_TOOLKITS.findIndex((toolkit) => toolkit.slug === a.slug);
    const featuredB = FEATURED_TOOLKITS.findIndex((toolkit) => toolkit.slug === b.slug);
    if (featuredA !== -1 || featuredB !== -1) {
      return (featuredA === -1 ? 99 : featuredA) - (featuredB === -1 ? 99 : featuredB);
    }
    return a.name.localeCompare(b.name);
  });
}

export async function createConnectionLink(
  toolkit: string,
  userId: string,
  callbackUrl?: string,
): Promise<{ redirectUrl: string }> {
  const slug = toolkit.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!slug) throw new ApiError("Invalid toolkit.", 400);

  let authConfigId: string | undefined;

  const configs = await composioFetch(
    `/auth_configs?toolkit_slug=${encodeURIComponent(slug)}&limit=10`,
  ).catch(() => ({}) as Json);

  for (const config of items(configs)) {
    const configSlug = toolkitSlugOf(config) ?? asString((config.toolkit as Json | undefined)?.slug);
    if (configSlug === slug || !configSlug) {
      authConfigId = asString(config.id);
      if (authConfigId) break;
    }
  }

  if (!authConfigId) {
    throw new ApiError(
      `No Composio auth config exists for ${slug} yet. Create one in the Composio dashboard (Auth configs → ${slug}), then try again.`,
      400,
      "auth_config_missing",
    );
  }

  const data = await composioFetch("/connected_accounts/link", {
    method: "POST",
    body: JSON.stringify({
      auth_config_id: authConfigId,
      user_id: userId,
      ...(callbackUrl ? { callback_url: callbackUrl } : {}),
    }),
  });

  const redirectUrl =
    asString(data.redirect_url) ??
    asString(data.redirectUrl) ??
    asString((data.data as Json | undefined)?.redirect_url);

  if (!redirectUrl) {
    throw new ApiError("Composio did not return a connection URL.", 502, "link_missing");
  }

  return { redirectUrl };
}

export async function executeTool(
  action: string,
  userId: string,
  args: Record<string, unknown>,
): Promise<{ successful: boolean; data: unknown; error?: string }> {
  const slug = action.toUpperCase().replace(/[^A-Z0-9_]/g, "");
  if (!slug) throw new ApiError("Invalid action name.", 400);

  const data = await composioFetch(`/tools/execute/${slug}`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, arguments: args }),
  });

  return {
    successful: data.successful !== false && !data.error,
    data: data.data ?? data.response ?? data,
    error: asString(data.error),
  };
}
