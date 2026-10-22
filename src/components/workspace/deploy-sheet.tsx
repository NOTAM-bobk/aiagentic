"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, Globe, KeyRound, Loader2, Rocket, X } from "lucide-react";
import type { DeployRecord, Project } from "@/lib/protocol";
import { cn } from "@/lib/utils";
import { Sheet } from "./sheets";

type NameCheck = { available: boolean; host: string; url: string; reason?: string };
type Report = {
  ok: boolean;
  host: string;
  url: string;
  state: string;
  warning?: string;
  deploymentUrl?: string;
  framework: string | null;
  files: number;
};

const DOMAIN = "base31.org";

export function DeploySheet({
  open,
  onClose,
  project,
  deployed,
  onDeployed,
  onOpenSetup,
  onToast,
}: {
  open: boolean;
  onClose: () => void;
  project: Project | null;
  deployed: DeployRecord | null;
  onDeployed: (deploy: DeployRecord) => void;
  onOpenSetup: () => void;
  onToast: (message: string | null) => void;
}) {
  const [label, setLabel] = useState("");
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<NameCheck | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);
  // Read through a ref so a fresh deploy does not retrigger the form reset below.
  const deployedRef = useRef<DeployRecord | null>(deployed);

  useEffect(() => {
    deployedRef.current = deployed;
  }, [deployed]);

  useEffect(() => {
    if (!open) return;
    const slug = (project?.title ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    // Reset the form for each open; the sheet stays mounted otherwise.
    // A deployed project reopens on its live address instead of the title.
    const host = deployedRef.current?.host ?? "";
    setLabel(host.replace(new RegExp(`\\.${DOMAIN.replace(/\./g, "\\.")}$`), "") || slug);
    setCheck(null);
    setReport(null);
    setError(null);
    setNeedsKey(false);
  }, [open, project?.id, project?.title]);

  async function checkName() {
    setChecking(true);
    setError(null);
    setCheck(null);
    try {
      const response = await fetch(`/api/deploy/check?name=${encodeURIComponent(label)}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as NameCheck & { error?: string; code?: string };
      if (!response.ok) {
        if ([ "vercel_missing", "domain_missing", "vercel_auth" ].includes(data.code ?? "")) {
          setNeedsKey(true);
        }
        throw new Error(data.error ?? "Could not check that subdomain.");
      }
      setCheck(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not check that subdomain.");
    } finally {
      setChecking(false);
    }
  }

  async function deploy() {
    if (!project || project.files.length === 0) return;
    setDeploying(true);
    setError(null);
    setReport(null);
    try {
      const response = await fetch("/api/deploy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: label, files: project.files }),
      });
      const data = (await response.json()) as Report & { error?: string; code?: string };
      if (!response.ok) {
        if ([ "vercel_missing", "domain_missing", "vercel_auth" ].includes(data.code ?? "")) {
          setNeedsKey(true);
        }
        throw new Error(data.error ?? "Deploy failed.");
      }
      setReport(data);
      onDeployed({ host: data.host, url: data.url, state: data.state, at: Date.now() });
      onToast(
        data.ok ? `Live at ${data.host}` : `Deploying to ${data.host} — Vercel is building`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Deploy failed.");
    } finally {
      setDeploying(false);
    }
  }

  const files = project?.files.length ?? 0;

  return (
    <Sheet open={open} onClose={onClose} title="deploy" subtitle={`publish to a ${DOMAIN} subdomain`}>
      {needsKey ? (
        <div className="rounded-2xl border border-line bg-paper-2/40 px-3 py-3">
          <p className="flex items-center gap-2 font-mono text-[12.5px] text-ink">
            <KeyRound className="h-3.5 w-3.5 text-ink-faint" /> connect Vercel
          </p>
          <p className="mt-2 font-mono text-[11.5px] leading-relaxed text-ink-soft">
            Deploys use a Vercel token, and {DOMAIN} must be added to the same Vercel account or
            team. The token needs access to create projects and add domains.
          </p>
          <button
            type="button"
            onClick={onOpenSetup}
            className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-xl border border-ember/40 bg-ember/10 px-3 font-mono text-[12px] text-ember transition-colors hover:border-ember"
          >
            <KeyRound className="h-3.5 w-3.5" /> add a Vercel token
          </button>
        </div>
      ) : (
        <>
          {deployed && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-ember/30 bg-ember/10 px-2.5 py-2 font-mono text-[11.5px]">
              <Check className="h-3 w-3 shrink-0 text-ember" />
              <a
                href={deployed.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 truncate text-ember hover:underline"
              >
                {deployed.host}
              </a>
              <span className="ml-auto shrink-0 text-[10.5px] uppercase tracking-wider text-ink-faint">
                {deployed.state.toLowerCase()}
              </span>
            </div>
          )}

          <p className="font-mono text-[11.5px] leading-relaxed text-ink-faint">
            {files > 0
              ? `${files} file${files === 1 ? "" : "s"} from this project. Vercel builds frameworks from source.`
              : "Build the site first — there are no files to deploy."}
          </p>

          <label className="mt-4 block font-mono text-[10.5px] uppercase tracking-wider text-ink-faint">
            your url
            <div className="mt-1.5 flex items-stretch gap-1.5">
              <div className="flex min-h-10 min-w-0 flex-1 items-center rounded-xl border border-line bg-paper px-2.5 focus-within:border-ember/60">
                <Globe className="mr-2 h-3.5 w-3.5 shrink-0 text-ink-faint" />
                <input
                  value={label}
                  onChange={(event) => {
                    setLabel(event.target.value);
                    setCheck(null);
                    setReport(null);
                  }}
                  placeholder="my-site"
                  autoComplete="off"
                  spellCheck={false}
                  className="min-h-9 w-full min-w-0 border-0 bg-transparent text-[13px] normal-case tracking-normal text-ink placeholder:text-ink-faint/70 focus:outline-none"
                />
                <span className="shrink-0 pl-1 font-mono text-[11.5px] text-ink-faint">.{DOMAIN}</span>
              </div>
              <button
                type="button"
                onClick={() => void checkName()}
                disabled={checking || label.trim().length < 3}
                className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 font-mono text-[11.5px] uppercase tracking-wider text-ink-soft transition-colors hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                {checking ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                check
              </button>
            </div>
          </label>

          {check && (
            <p
              className={cn(
                "mt-3 flex items-start gap-2 rounded-xl border px-2.5 py-2 font-mono text-[11.5px] leading-relaxed",
                check.available
                  ? "border-ember/30 bg-ember/10 text-ember"
                  : "border-alert/30 bg-alert-soft/40 text-ink-soft",
              )}
            >
              {check.available ? <Check className="mt-px h-3.5 w-3.5 shrink-0" /> : <X className="mt-px h-3.5 w-3.5 shrink-0" />}
              {check.available ? `${check.host} is available` : (check.reason ?? "That name is taken.")}
            </p>
          )}

          <button
            type="button"
            onClick={() => void deploy()}
            disabled={deploying || !check?.available || files === 0}
            className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-ember/40 bg-ember/10 px-3 font-mono text-[12.5px] text-ember transition-colors hover:border-ember disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deploying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            {deploying ? "deploying…" : `deploy to ${label || "your subdomain"}.${DOMAIN}`}
          </button>
          {!check?.available && !deploying && (
            <p className="mt-2 font-mono text-[10.5px] leading-relaxed text-ink-faint">
              check the subdomain first, then deploy.
            </p>
          )}

          {report && (
            <div className="mt-4 rounded-2xl border border-line bg-paper-2/50 px-3 py-3 font-mono">
              <p className="flex items-center gap-2 text-[12.5px] text-ink">
                {report.ok ? <Check className="h-3.5 w-3.5 text-ember" /> : <Loader2 className="h-3.5 w-3.5 animate-spin text-ember" />}
                {report.state.toLowerCase()}
                <span className="ml-auto text-[10.5px] text-ink-faint">
                  {report.framework ?? "static"} · {report.files} files
                </span>
              </p>
              <a
                href={report.url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[12px] text-ember hover:underline"
              >
                {report.host} <ArrowUpRight className="h-2.5 w-2.5" />
              </a>
              {report.warning && (
                <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">{report.warning}</p>
              )}
            </div>
          )}
        </>
      )}

      {error && (
        <p className="mt-3 rounded-xl border-l-2 border-l-alert bg-alert-soft/40 px-2.5 py-2 font-mono text-[11.5px] leading-relaxed text-ink-soft">
          {error}
        </p>
      )}
    </Sheet>
  );
}
