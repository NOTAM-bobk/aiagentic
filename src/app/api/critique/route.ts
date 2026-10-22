import { NextResponse } from "next/server";
import { generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { GROQ_BUILDER_MODEL } from "@/lib/models";
import { apiKey, requestApiKeys, withApiKeys } from "@/lib/keys-server";
import { CRITIC_PROMPT } from "@/lib/prompts";
import type { Plan } from "@/lib/protocol";
import { truncate } from "@/lib/utils";

export const maxDuration = 60;

/**
 * A second opinion. The builder is never its own reviewer: if Gemini built the
 * site, Groq reviews it, and vice versa. The notes go back into the next build
 * round as results, so the agent fixes what is real instead of guessing.
 */

type Body = {
  builder?: string;
  request?: string;
  plan?: Plan | null;
  files?: { path: string; content: string }[];
};

const TEXT_FILE = /\.(html|css|js|jsx|mjs|cjs|ts|tsx|astro|vue|svelte|md|txt)$/i;
const MAX_FILE_CHARS = 5000;
const MAX_TOTAL_CHARS = 16_000;

function extractJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function lines(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/\s+/g, " ").trim().slice(0, 280))
    .filter(Boolean)
    .slice(0, max);
}

function digest(files: Body["files"]): string {
  const ranked = [...(files ?? [])]
    .filter((file) => TEXT_FILE.test(file.path))
    .sort((a, b) => {
      const weight = (path: string) =>
        /index\.html$|app\/page|src\/App|page\.tsx$|index\.css$|styles\.css$|app\.css$|globals\.css$/i.test(path)
          ? 0
          : 1;
      return weight(a.path) - weight(b.path);
    })
    .slice(0, 4);

  let budget = MAX_TOTAL_CHARS;
  const blocks: string[] = [];
  for (const file of ranked) {
    if (budget <= 0) break;
    const content = truncate(file.content, Math.min(MAX_FILE_CHARS, budget));
    blocks.push(`<file path="${file.path}">\n${content}\n</file>`);
    budget -= content.length;
  }
  if (blocks.length === 0) return "No text files yet.";
  return `${blocks.join("\n\n")}\n\n${(files ?? []).length > ranked.length ? `${(files ?? []).length - ranked.length} more files not shown.` : ""}`;
}

export async function POST(request: Request) {
  return withApiKeys(requestApiKeys(request), () => run(request));
}

async function run(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body;

  const groqKey = apiKey("groq");
  const googleKey = apiKey("google") ?? process.env.GOOGLE_API_KEY;
  const builtWithGroq = (body.builder ?? "").startsWith("groq");
  // Prefer the other family. When only one provider has a key, review with a
  // heavier model than the build so it is not the same voice re-reading itself.
  const useGroq = builtWithGroq ? !googleKey && Boolean(groqKey) : Boolean(groqKey);
  const reviewModel = process.env.GOOGLE_REVIEW_MODEL?.trim() || "gemini-2.5-pro";
  const modelName = useGroq ? GROQ_BUILDER_MODEL : reviewModel;
  const provider = useGroq ? createGroq({ apiKey: groqKey }) : createGoogleGenerativeAI({ apiKey: googleKey });
  if (!groqKey && !googleKey) {
    return NextResponse.json({ issues: [], ideas: [], skipped: "no_reviewer" });
  }

  const plan = body.plan ?? null;
  const prompt = [
    `Project: ${plan?.title ?? "a site being built"}`,
    plan?.concept ? `Concept: ${plan.concept}` : "",
    plan?.stack ? `Stack: ${plan.stack}` : "",
    `What the user asked for:\n${truncate(body.request ?? "", 900)}`,
    `The files:\n\n${digest(body.files)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const { text } = await generateText({
      model: provider(modelName),
      system: CRITIC_PROMPT,
      prompt,
      temperature: 0.45,
      maxOutputTokens: 900,
      maxRetries: 1,
    });

    const data = extractJson(text);
    if (!data) {
      return NextResponse.json({ issues: [], ideas: [], verdict: "", model: modelName });
    }

    return NextResponse.json({
      verdict: typeof data.verdict === "string" ? data.verdict.replace(/\s+/g, " ").slice(0, 300) : "",
      issues: lines(data.issues, 4),
      ideas: lines(data.ideas, 3),
      model: modelName,
    });
  } catch (error) {
    console.error("[kiln] critique failed", error);
    return NextResponse.json({ issues: [], ideas: [], skipped: "review_failed" });
  }
}
