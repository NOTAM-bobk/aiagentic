import { NextResponse } from "next/server";
import { fail, handleError } from "@/lib/http";

export const maxDuration = 30;

/**
 * Check the thing that actually shipped. Static checks run on the project files
 * even when the preview URL is not reachable from the server; the live fetch
 * adds the rendered HTML and any runtime error banner.
 */

type Body = {
  url?: string;
  files?: { path: string; content: string }[];
  images?: string[];
};

const PRIVATE_HOST =
  /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|\[?::1\]?)/i;
const ERROR_MARKERS = [
  "Failed to resolve import",
  "Cannot find module",
  "Module not found",
  "Internal Server Error",
  "vite-error-overlay",
  "ReferenceError:",
  "SyntaxError:",
];
const PLACEHOLDERS = [/lorem ipsum/i, /your headline here/i, /\[ ?insert/i, /\bTODO\b/];

function staticIssues(files: { path: string; content: string }[], images: string[]): string[] {
  const issues: string[] = [];
  const byPath = new Map(files.map((file) => [file.path, file.content]));
  const entry =
    byPath.get("index.html") ??
    [...byPath.entries()].find(([path]) => path.endsWith(".html"))?.[1] ??
    "";

  if (!entry) {
    const hasFramework = files.some((file) =>
      /^(app\/page\.(tsx|jsx|js|ts)|src\/App\.(tsx|jsx)|src\/pages\/index|src\/routes\/\+page)/.test(file.path),
    );
    if (!hasFramework && files.length > 0) issues.push("There is no HTML entry point and no framework page to render.");
  } else {
    if (!/<title>\s*\S[^<]*<\/title>/i.test(entry)) issues.push("The page has no useful <title>.");
    if (!/<h1[\s>]/i.test(entry)) issues.push("The page has no <h1>, so it has no visible subject.");
    if (!/<meta[^>]+name=["']viewport["']/i.test(entry)) {
      issues.push("No viewport meta tag, so the page will not lay out correctly on phones.");
    }
    for (const match of entry.matchAll(/<img\b([^>]*)>/gi)) {
      if (!/\balt\s*=/i.test(match[1])) {
        issues.push(`An <img> has no alt text: ${match[0].slice(0, 90)}`);
        break;
      }
    }
  }

  for (const pattern of PLACEHOLDERS) {
    const found = files.find((file) => pattern.test(file.content));
    if (found) {
      issues.push(`${found.path} still contains placeholder copy (“${pattern.source.replace(/\\/g, "")}”).`);
      break;
    }
  }

  const known = new Set([...files.map((file) => file.path), ...images]);
  for (const file of files.slice(0, 12)) {
    for (const match of file.content.matchAll(/(?:src|href)=["'](?!https?:|data:|mailto:|#|\/\/)([^"'?#]+)/gi)) {
      const ref = match[1].replace(/^\.\//, "").replace(/^\//, "");
      if (!/\.(png|jpe?g|webp|avif|gif|svg|ico)$/i.test(ref)) continue;
      if (!known.has(ref)) {
        issues.push(`${file.path} references ${ref}, which is not in the project.`);
        break;
      }
    }
  }

  return issues.slice(0, 8);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const files = (body.files ?? []).slice(0, 80).map((file) => ({
      path: String(file.path ?? ""),
      content: String(file.content ?? "").slice(0, 400_000),
    }));
    const images = (body.images ?? []).filter((path): path is string => typeof path === "string");
    const issues = staticIssues(files, images);

    const raw = (body.url ?? "").trim();
    if (!raw) {
      return NextResponse.json({ reachable: false, issues, status: null });
    }

    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return fail("That preview URL is not valid.", 400, "verify_url_invalid");
    }
    if (!/^https?:$/.test(url.protocol) || PRIVATE_HOST.test(url.hostname)) {
      return fail("Only public preview URLs can be checked.", 400, "verify_url_private");
    }

    try {
      const response = await fetch(url, {
        headers: { "user-agent": "kiln-verify/1", accept: "text/html,*/*" },
        cache: "no-store",
        redirect: "follow",
        signal: AbortSignal.timeout(9000),
      });
      if (!response.ok) {
        issues.unshift(`The preview returned HTTP ${response.status}.`);
        return NextResponse.json({ reachable: true, status: response.status, issues });
      }

      const html = (await response.text()).slice(0, 300_000);
      const title = /<title>\s*([^<]{0,120})\s*<\/title>/i.exec(html)?.[1]?.trim() ?? "";
      const marker = ERROR_MARKERS.find((needle) => html.includes(needle));
      if (marker && html.length < 5000) {
        issues.unshift(`The page is showing an error screen (${marker}).`);
      }
      if (html.trim().length < 40) {
        issues.unshift("The page rendered almost nothing.");
      }

      return NextResponse.json({
        reachable: true,
        status: response.status,
        title,
        issues: issues.slice(0, 8),
      });
    } catch (error) {
      // A sandbox URL that the server cannot reach is not a build failure.
      return NextResponse.json({
        reachable: false,
        status: null,
        issues: issues.slice(0, 8),
        note: `The preview could not be fetched from here (${error instanceof Error ? error.message : "network error"}).`,
      });
    }
  } catch (error) {
    return handleError(error);
  }
}
