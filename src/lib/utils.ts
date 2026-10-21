import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function truncate(value: string, max = 4000): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}\n… truncated ${value.length - max} characters`;
}

export function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function slugTitle(input: string): string {
  const stop = new Set(["a", "an", "the", "for", "with", "and", "of", "to", "my", "our", "in", "on"]);
  const words = input
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !stop.has(word.toLowerCase()))
    .slice(0, 3);
  if (words.length === 0) return "Untitled site";
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/** Inline local CSS/JS into a single HTML document so a browser-only project can preview itself. */
export function bundleHtml(files: { path: string; content: string }[]): string {
  const index = files.find((file) => file.path === "index.html");
  if (!index) {
    return `<!doctype html><html><body style="font-family:ui-sans-serif,system-ui;padding:40px;color:#3f3a33">
      <h1 style="font-size:18px">No index.html yet</h1>
      <p style="font-size:14px;line-height:1.6">Ask Kiln to build a page and the preview will appear here.</p>
    </body></html>`;
  }

  const byPath = new Map(files.map((file) => [file.path, file.content]));
  let html = index.content;

  html = html.replace(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi, (match, href: string) => {
    const clean = href.replace(/^\.\//, "").replace(/^\//, "");
    if (match.toLowerCase().includes("stylesheet") && byPath.has(clean)) {
      return `<style>\n${byPath.get(clean)}\n</style>`;
    }
    return match;
  });

  html = html.replace(/<script([^>]*)src=["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (match, before, src: string) => {
    const clean = src.replace(/^\.\//, "").replace(/^\//, "");
    if (byPath.has(clean)) {
      return `<script${before}>\n${byPath.get(clean)}\n</script>`;
    }
    return match;
  });

  return html;
}
