import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
});

// Resolve the public origin so Open Graph links follow whatever domain the app is
// deployed to: an explicit NEXT_PUBLIC_SITE_URL, then Vercel's own hostnames.
const configuredSite = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
const siteUrl = (configuredSite || (vercelHost ? `https://${vercelHost}` : "http://localhost:3000")).replace(
  /\/+$/,
  "",
);

// `metadataBase` needs an absolute URL; accept a bare domain in the env var too.
const metadataBase = new URL(/^https?:\/\//.test(siteUrl) ? siteUrl : `https://${siteUrl}`);

export const metadata: Metadata = {
  metadataBase,
  title: "Kiln — describe a site, watch it get built",
  description:
    "Kiln is an agentic website studio. A planner thinks, a builder writes real code, and a Daytona sandbox runs it live. Groq plans, Gemini and Puter build, Tavily searches, Composio connects.",
  openGraph: {
    title: "Kiln — the agentic website studio",
    description:
      "Chat with an agent that plans, searches, codes, and runs your website in a live sandbox. Minimal, fast, and free to start.",
    type: "website",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
