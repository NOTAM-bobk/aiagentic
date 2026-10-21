"use client";

type PuterChunk = {
  text?: string;
  message?: { content?: string | { text?: string }[] };
};

type PuterAI = {
  chat: (
    messages: { role: string; content: string }[],
    options?: { model?: string; stream?: boolean; temperature?: number },
  ) => Promise<string | AsyncIterable<PuterChunk>>;
};

export type PuterUser = { username?: string; email?: string; uuid?: string };

type PuterSignInResult = {
  success?: boolean;
  username?: string;
  error?: string;
  msg?: string;
};

type PuterAuth = {
  signIn: () => Promise<PuterSignInResult | undefined>;
  signOut: () => void;
  isSignedIn: () => boolean;
  getUser: () => Promise<PuterUser>;
};

declare global {
  interface Window {
    puter?: { ai?: PuterAI; auth?: PuterAuth };
  }
}

let loader: Promise<void> | null = null;

export function loadPuter(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.puter?.ai) return Promise.resolve();
  if (loader) return loader;

  loader = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-klin-puter="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Puter.js failed to load.")));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://js.puter.com/v2/";
    script.async = true;
    script.dataset.klinPuter = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Puter.js. Check your network and retry."));
    document.head.appendChild(script);
  });

  return loader;
}

function chunkText(chunk: PuterChunk | string): string {
  if (typeof chunk === "string") return chunk;
  if (typeof chunk.text === "string") return chunk.text;
  const content = chunk.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => part.text ?? "").join("");
  }
  return "";
}

/** The signed-in Puter user, or null. Safe to call before the SDK has loaded. */
export async function puterSession(): Promise<PuterUser | null> {
  await loadPuter();
  const auth = window.puter?.auth;
  if (!auth || !auth.isSignedIn()) return null;
  try {
    return await auth.getUser();
  } catch {
    return null;
  }
}

/** Opens Puter's sign-in popup, then returns the user it signed in. */
export async function puterSignIn(): Promise<PuterUser | null> {
  await loadPuter();
  const auth = window.puter?.auth;
  if (!auth) throw new Error("Puter.js could not load. Check your network and retry.");

  if (!auth.isSignedIn()) {
    const result = await auth.signIn();
    if (result && result.success === false) {
      throw new Error(result.error ?? result.msg ?? "Puter sign-in did not complete.");
    }
  }

  return puterSession();
}

export function puterSignOut(): void {
  window.puter?.auth?.signOut();
}

export async function puterChat(input: {
  messages: { role: string; content: string }[];
  model?: string;
  onDelta: (text: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  if (typeof window === "undefined" || !window.puter?.ai) {
    throw new Error("Puter is still loading. Give it a second and retry.");
  }

  const response = await window.puter.ai.chat(input.messages, {
    ...(input.model ? { model: input.model } : {}),
    stream: true,
  });

  if (typeof response === "string") {
    input.onDelta(response);
    return response;
  }

  let full = "";
  for await (const chunk of response) {
    if (input.signal?.aborted) break;
    const text = chunkText(chunk);
    if (text) {
      full += text;
      input.onDelta(text);
    }
  }
  return full;
}
