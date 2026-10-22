"use client";

import { KEY_HEADER, sanitizeApiKeys, type ApiKeyMap } from "./keys";

const STORAGE_KEY = "kiln.keys.v1";

export function readKeys(): ApiKeyMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return sanitizeApiKeys(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function saveKeys(next: ApiKeyMap): ApiKeyMap {
  const clean = sanitizeApiKeys(next);
  try {
    if (Object.keys(clean).length === 0) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Private mode with storage disabled: keys still apply for this page load.
  }
  return clean;
}

export function hasStoredKeys(): boolean {
  return Object.keys(readKeys()).length > 0;
}

function encode(keys: ApiKeyMap): string {
  const bytes = new TextEncoder().encode(JSON.stringify(keys));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window.btoa(binary);
}

function keyHeader(): Record<string, string> {
  const keys = readKeys();
  return Object.keys(keys).length > 0 ? { [KEY_HEADER]: encode(keys) } : {};
}

/**
 * Attach the browser's saved keys to every same-origin API call, including
 * calls made before the workspace mounts. Wrapping fetch once avoids threading
 * credentials through every call site.
 */
export function installKeyFetch(): void {
  if (typeof window === "undefined") return;
  const flag = "__kilnKeyFetch" as const;
  const patched = window as unknown as Record<string, boolean>;
  if (patched[flag]) return;
  patched[flag] = true;

  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const rawUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const sameOrigin = rawUrl.startsWith("/") || rawUrl.startsWith(window.location.origin);
      if (sameOrigin && rawUrl.includes("/api/")) {
        const headers = new Headers(
          init?.headers ?? (input instanceof Request ? input.headers : undefined),
        );
        for (const [name, value] of Object.entries(keyHeader())) {
          if (!headers.has(name)) headers.set(name, value);
        }
        return original(input, { ...init, headers });
      }
    } catch {
      // Fall through to the unmodified request.
    }
    return original(input, init);
  };
}

installKeyFetch();
