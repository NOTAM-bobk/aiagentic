import type { Metadata } from "next";
import { Workspace } from "@/components/workspace/workspace";

// The workspace reads ?prompt= on the server, which blocks prerendering by design.
export const instant = false;

export const metadata: Metadata = {
  title: "Workspace — Kiln",
  description: "Chat with the agent, watch it write files, and see the site run live.",
};

export default async function BuildPage({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string | string[] }>;
}) {
  const params = await searchParams;
  const prompt = Array.isArray(params.prompt) ? params.prompt[0] : params.prompt;

  return <Workspace initialPrompt={prompt?.slice(0, 2000)} />;
}
