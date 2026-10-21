import type { Metadata } from "next";
import { Workspace } from "@/components/workspace/workspace";

// The workspace reads ?prompt= on the server, which blocks prerendering by design.
export const instant = false;

export const metadata: Metadata = {
  title: "kiln — describe a site, watch it build",
  description:
    "A terminal for building websites. Chat with an agent that plans, searches, writes real files, and runs your site in a live sandbox.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string | string[] }>;
}) {
  const params = await searchParams;
  const prompt = Array.isArray(params.prompt) ? params.prompt[0] : params.prompt;

  return <Workspace initialPrompt={prompt?.slice(0, 2000)} />;
}
