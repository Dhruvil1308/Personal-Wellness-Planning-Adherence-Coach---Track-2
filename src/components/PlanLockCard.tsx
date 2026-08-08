"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { GateStatus } from "@/lib/services/planGate";
import { ProgressBar } from "@/components/ui";
import { LockIcon } from "@/components/icons";

/**
 * Shown instead of "Generate this plan" when the adherence gate is closed.
 *
 * It has to do two jobs at once: state the rule plainly enough that the number
 * feels fair, and offer the documented way out — without the override a locked
 * day can never be recovered, because a day with no plan has nothing to check
 * in on.
 */
export function PlanLockCard({ date, gate }: { date: string; gate: GateStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");

  const achieved = gate.achievedPct ?? 0;
  const threshold = gate.thresholdPct;

  async function unlock() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/plan/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not unlock this day");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not unlock this day");
      setBusy(false);
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-start gap-4 p-6">
        <span
          aria-hidden
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-warn-soft text-warn"
        >
          <LockIcon className="h-5 w-5" />
        </span>

        <div className="min-w-64 flex-1">
          <h2 className="text-lg font-semibold tracking-tight">
            This day is locked
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            A new plan is only generated once the previous day reaches{" "}
            <strong className="text-foreground">{threshold}%</strong> completion.{" "}
            {gate.blockedByLabel} finished at{" "}
            <strong className="text-foreground">{achieved}%</strong> — {gate.shortfallPct}{" "}
            percentage points short.
          </p>

          <div className="mt-4 max-w-md">
            <div className="flex items-baseline justify-between text-xs font-medium">
              <span className="text-muted">{gate.blockedByLabel} completion</span>
              <span className="tabular-nums">
                {achieved}% of {threshold}%
              </span>
            </div>
            <div className="relative mt-1.5">
              <ProgressBar
                value={(achieved / Math.max(threshold, 1)) * 100}
                tone={achieved >= threshold ? "bg-brand" : "bg-warn"}
              />
              <span
                aria-hidden
                className="absolute -top-1 h-4 w-0.5 bg-ink/40"
                style={{ left: "100%" }}
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            {gate.blockedByDate && (
              <Link href={`/today?date=${gate.blockedByDate}`} className="btn-primary">
                Finish {gate.blockedByLabel}
              </Link>
            )}
            {!confirming && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setConfirming(true)}
              >
                Unlock anyway
              </button>
            )}
          </div>

          <p className="mt-3 text-xs leading-relaxed text-muted">
            Logging what you actually did on {gate.blockedByLabel} is the intended
            route — the score is computed live, so the moment it reaches {threshold}%
            this day unlocks itself.
          </p>
        </div>
      </div>

      {confirming && (
        <div className="animate-fade-up border-t border-line bg-background p-5">
          <p className="text-sm font-medium">Override the {threshold}% rule for this day?</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            This is recorded against the day, with the score that was missed, so the
            override stays visible afterwards.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              className="input max-w-sm py-2 text-sm"
              placeholder="Reason (optional) — e.g. was travelling, no signal"
              value={reason}
              maxLength={300}
              onChange={(e) => setReason(e.target.value)}
            />
            <button type="button" className="btn-primary" disabled={busy} onClick={unlock}>
              {busy ? "Unlocking…" : "Confirm override"}
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </div>
          {error && <p className="mt-2 text-sm font-medium text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
