"use client";

import { useCallback, useEffect, useState } from "react";
import {
  puterSession,
  puterSignIn,
  puterSignOut,
  type PuterUser,
} from "@/lib/puter";
import { cn } from "@/lib/utils";

/**
 * Puter is the key-less builder path, so the account lives in the header rather
 * than behind a settings sheet: sign in once and every browser build uses it.
 */
export function PuterAccount({
  onNotify,
  className,
}: {
  onNotify?: (message: string) => void;
  className?: string;
}) {
  const [user, setUser] = useState<PuterUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    puterSession()
      .then((session) => {
        if (!cancelled) setUser(session);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (user) {
        puterSignOut();
        setUser(null);
        onNotify?.("Signed out of Puter.");
      } else {
        const session = await puterSignIn();
        setUser(session);
        if (session) onNotify?.(`Signed in to Puter as ${session.username ?? "your account"}.`);
      }
    } catch (error) {
      onNotify?.(error instanceof Error ? error.message : "Puter sign-in failed.");
    } finally {
      setBusy(false);
    }
  }, [busy, onNotify, user]);

  const label = loading ? "puter …" : user ? `@${user.username ?? "puter"}` : "puter sign in";

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      title={
        user
          ? `Signed in to Puter as ${user.username ?? "your account"} — click to sign out`
          : "Sign in to Puter for free, key-less builds"
      }
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[10.5px] transition-colors disabled:opacity-60",
        user
          ? "border-ember/40 text-ember hover:border-ember hover:bg-ember-soft/60"
          : "border-line text-ink-soft hover:border-ember hover:text-ember",
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          loading ? "bg-ink-faint animate-pulse-dot" : user ? "bg-ember" : "bg-line-strong",
        )}
      />
      <span className="max-w-[132px] truncate">{label}</span>
    </button>
  );
}
