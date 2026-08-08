"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DailySummary } from "@/generated/prisma/client";
import { AdherenceRing, AIBadge, ProgressBar } from "@/components/ui";

function parseList(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export function SummaryPanel({
  date,
  summary,
  itemsPending,
}: {
  date: string;
  summary: DailySummary | null;
  itemsPending: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedBy, setGeneratedBy] = useState<string | null>(null);

  async function build() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not build the summary");
      setGeneratedBy(data.generatedBy);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build the summary");
    } finally {
      setBusy(false);
    }
  }

  const wins = summary ? parseList(summary.wins) : [];
  const gaps = summary ? parseList(summary.gaps) : [];

  return (
    <div className="space-y-4">
      {!summary && (
        <p className="text-sm leading-relaxed text-muted">
          Wrap the day up and WellPath will write a recap from your recorded check-ins
          only — nothing invented.
          {itemsPending > 0 && (
            <>
              {" "}
              <span className="font-medium text-warn">
                {itemsPending} item{itemsPending === 1 ? "" : "s"} still unlogged
              </span>{" "}
              — they will be reported as not logged.
            </>
          )}
        </p>
      )}

      {summary && (
        <div className="animate-fade-up space-y-4">
          <div className="flex flex-wrap items-center gap-5">
            <AdherenceRing pct={summary.adherencePct} />
            <div className="min-w-52 flex-1 space-y-2.5">
              <Bar label="Meals" pct={summary.mealPct} tone="bg-meal" />
              <Bar label="Hydration" pct={summary.waterPct} tone="bg-water" />
              <Bar label="Movement" pct={summary.exercisePct} tone="bg-exercise" />
              <p className="pt-1 text-xs text-muted">
                {summary.itemsCompleted} of {summary.itemsTotal} items completed ·{" "}
                {summary.waterMl} ml water · ~{summary.caloriesConsumed} kcal from logged
                meals
              </p>
            </div>
          </div>

          <p className="text-[15px] leading-relaxed">{summary.summaryText}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            {wins.length > 0 && (
              <div className="rounded-xl bg-brand-soft p-3.5">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-strong">
                  What worked
                </p>
                <ul className="mt-1.5 space-y-1 text-sm text-brand-strong">
                  {wins.map((w) => (
                    <li key={w}>• {w}</li>
                  ))}
                </ul>
              </div>
            )}
            {gaps.length > 0 && (
              <div className="rounded-xl bg-warn-soft p-3.5">
                <p className="text-xs font-bold uppercase tracking-wide text-warn">
                  What slipped
                </p>
                <ul className="mt-1.5 space-y-1 text-sm text-warn">
                  {gaps.map((g) => (
                    <li key={g}>• {g}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {summary.focusTomorrow && (
            <p className="rounded-xl border border-line bg-background px-3.5 py-3 text-sm">
              <span className="font-bold">Tomorrow&apos;s focus: </span>
              {summary.focusTomorrow}
            </p>
          )}
        </div>
      )}

      {error && <p className="text-sm font-medium text-danger">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={build} disabled={busy} className="btn-primary">
          {busy ? "Reading your day…" : summary ? "Rebuild summary" : "End my day"}
        </button>
        {generatedBy && <AIBadge generatedBy={generatedBy} />}
      </div>
    </div>
  );
}

function Bar({ label, pct, tone }: { label: string; pct: number; tone: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs font-medium">
        <span>{label}</span>
        <span className="tabular-nums text-muted">{pct}%</span>
      </div>
      <ProgressBar value={pct} tone={tone} className="mt-1" />
    </div>
  );
}
