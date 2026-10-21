import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
  title: "kiln — terminal for building websites",
  description:
    "Describe a site and watch an agent plan it, write real files, and run it live. A minimal terminal workspace powered by Groq, Gemini, Puter, Daytona, Tavily, and Composio.",
  openGraph: {
    title: "kiln — terminal for building websites",
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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
