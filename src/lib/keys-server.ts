import { AsyncLocalStorage } from "node:async_hooks";
import { API_KEY_FIELDS, KEY_HEADER, sanitizeApiKeys, type ApiKeyId, type ApiKeyMap } from "./keys";

const ENV_NAME = Object.fromEntries(API_KEY_FIELDS.map((field) => [field.id, field.env])) as Record<
  ApiKeyId,
  string
>;

// Request-scoped keys supplied by the browser override server env vars. An
// AsyncLocalStorage keeps every helper below unchanged in signature while still
// scoping a key to the request that carried it.
const store = new AsyncLocalStorage<ApiKeyMap>();

export function withApiKeys<T>(keys: ApiKeyMap, fn: () => T): T {
  return store.run(keys, fn);
}

export function apiKey(id: ApiKeyId): string | undefined {
  const scoped = store.getStore()?.[id]?.trim();
  if (scoped) return scoped;
  const env = process.env[ENV_NAME[id]]?.trim();
  return env || undefined;
}

export function requestApiKeys(request?: Request): ApiKeyMap {
  if (!request) return {};
  const raw = request.headers.get(KEY_HEADER);
  if (!raw) return {};
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    return sanitizeApiKeys(JSON.parse(decoded));
  } catch {
    return {};
  }
}

/** Merge keys from the header with any explicit body keys (beacons cannot set headers). */
export function mergeApiKeys(request: Request | undefined, extra: unknown): ApiKeyMap {
  return { ...sanitizeApiKeys(extra), ...requestApiKeys(request) };
}
