import { NextResponse } from "next/server";
import { generateText } from "ai";
import { groq } from "@ai-sdk/groq";
import { google } from "@ai-sdk/google";
import { BUILDER_MODEL, GROQ_BUILDER_MODEL } from "@/lib/models";
import { TITLE_PROMPT } from "@/lib/prompts";
import { truncate } from "@/lib/utils";

export const maxDuration = 30;

type Body = { request?: string; reply?: string };

function clean(value: string): string | null {
  const line = value
    .replace(/```[a-z]*|```/gi, "")
    .split("\n")
    .map((part) => part.trim())
    .find(Boolean);
  if (!line) return null;
  const title = line
    .replace(/^#+\s*/, "")
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/[.!?:;]+$/, "")
    .trim()
    .slice(0, 64);
  if (!title || title.split(/\s+/).length > 8) return null;
  return title;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const prompt = (body.request ?? "").trim();
  if (!prompt) return NextResponse.json({ title: null });

  const model = process.env.GROQ_API_KEY
    ? groq(GROQ_BUILDER_MODEL)
    : process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY
      ? google(BUILDER_MODEL)
      : null;

  if (!model) return NextResponse.json({ title: null, reason: "no_model" });

  try {
    const { text } = await generateText({
      model,
      system: TITLE_PROMPT,
      prompt: [
        `First message:\n${truncate(prompt, 1200)}`,
        body.reply ? `Assistant reply:\n${truncate(body.reply, 800)}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      temperature: 0.3,
      maxOutputTokens: 32,
      maxRetries: 1,
    });

    return NextResponse.json({ title: clean(text) });
  } catch (error) {
    console.error("[kiln] title failed", error);
    return NextResponse.json({ title: null });
  }
}
