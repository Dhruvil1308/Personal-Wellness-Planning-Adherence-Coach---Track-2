import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getInsights } from "@/lib/services/insights";
import { getPlan } from "@/lib/services/plans";
import { computeAdherence, type PlanWithItems } from "@/lib/adherence";
import { prettyDay, today as todayKey } from "@/lib/date";
import { ADHERENCE_WEIGHTS } from "@/lib/constants";
import {
  AdherenceTrendChart,
  StreamChart,
} from "@/components/charts/AdherenceCharts";
import {
  AdherenceRing,
  EmptyState,
  ProgressBar,
  SectionTitle,
  StatTile,
  TypeBadge,
} from "@/components/ui";
import { DemoControls } from "@/components/DemoControls";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  // Signed out -> the login page. Signed in but no wellness profile yet -> finish it.
  if (!user) redirect("/login");
  if (!user.profileComplete) redirect("/onboarding");

  const date = todayKey();
  const insights = await getInsights(user.id, date, 14);
  const todayPlan = await getPlan(user.id, date);
  const todayAdherence = todayPlan
    ? computeAdherence(todayPlan as PlanWithItems)
    : null;

  if (insights.daysWithPlan === 0) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-5 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Adherence dashboard</h1>
        <EmptyState
          title="Nothing recorded yet"
          body="Generate a plan and log a few check-ins — this page then explains exactly how much of each plan you actually completed, and what keeps slipping."
          action={
            <Link href="/today" className="btn-primary">
              Go to today
            </Link>
          }
        />
        <DemoControls />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-7">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Adherence dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          Last {insights.trend.length} days · {insights.daysWithPlan} day
          {insights.daysWithPlan === 1 ? "" : "s"} with a plan
        </p>
      </header>

      {/* Hero: one number the page leads with, plus the split behind it. */}
      <section className="card mt-5 flex flex-wrap items-center gap-6 p-5">
        <AdherenceRing pct={insights.averageAdherence} size={148} label="average" />

        <div className="min-w-60 flex-1 space-y-3">
          <SectionTitle
            title="How this number is built"
            hint="Nothing here is estimated — it is computed from your recorded check-ins."
          />
          <StreamRow
            label="Meals"
            pct={insights.streamAverages.meal}
            weight={ADHERENCE_WEIGHTS.meal}
            tone="bg-meal"
          />
          <StreamRow
            label="Hydration"
            pct={insights.streamAverages.water}
            weight={ADHERENCE_WEIGHTS.water}
            tone="bg-water"
          />
          <StreamRow
            label="Movement"
            pct={insights.streamAverages.exercise}
            weight={ADHERENCE_WEIGHTS.exercise}
            tone="bg-exercise"
          />
          <p className="pt-1 text-xs leading-relaxed text-muted">
            Each stream scores 100% when every item is logged done. Partly-done counts
            half, hydration is measured against millilitres logged, and streams the plan
            does not contain are dropped and the weights renormalised.
          </p>
        </div>
      </section>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Today"
          value={todayAdherence ? `${todayAdherence.overallPct}%` : "No plan"}
          pct={todayAdherence?.overallPct ?? 0}
          sub={
            todayAdherence
              ? `${todayAdherence.itemsCompleted} of ${todayAdherence.itemsTotal} items logged done`
              : "Generate today's plan to start tracking"
          }
        />
        <StatTile
          label="Current streak"
          value={`${insights.currentStreak} day${insights.currentStreak === 1 ? "" : "s"}`}
          sub="Consecutive recent days at 70% or better"
        />
        <StatTile
          label="Best day"
          value={insights.bestDay ? `${insights.bestDay.overallPct}%` : "—"}
          pct={insights.bestDay?.overallPct ?? 0}
          sub={insights.bestDay ? prettyDay(insights.bestDay.date) : undefined}
        />
        <StatTile
          label="Hydration logged"
          value={`${insights.trend.reduce((s, t) => s + t.waterMl, 0)} ml`}
          sub={`Across ${insights.daysWithPlan} planned day${insights.daysWithPlan === 1 ? "" : "s"}`}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <SectionTitle
            title="Daily adherence"
            hint="One bar per planned day, coloured by how the day landed."
          />
          <AdherenceTrendChart trend={insights.trend} />
        </section>

        <section className="card p-5">
          <SectionTitle
            title="By stream"
            hint="Where the gap actually is — meals, hydration or movement."
          />
          <StreamChart trend={insights.trend} />
        </section>
      </div>

      <section className="card mt-5 p-5">
        <SectionTitle
          title="What keeps slipping"
          hint="Items skipped or never logged. These are exactly what the planner rewrites."
        />
        {insights.troubleSpots.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing has been missed in this window — the plan is fitting your day.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {insights.troubleSpots.map((t) => (
              <li
                key={`${t.type}-${t.title}`}
                className="flex flex-wrap items-center gap-3 py-3"
              >
                <TypeBadge type={t.type} />
                <span className="text-sm font-medium">{t.title}</span>
                <span className="text-xs tabular-nums text-muted">
                  scheduled {t.time}
                </span>
                <span className="ml-auto chip bg-danger-soft text-danger">
                  missed {t.misses}×
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs leading-relaxed text-muted">
          A repeated miss is treated as information about your schedule, not a failure.
          The next plan moves, shrinks or swaps these rather than repeating them.
        </p>
      </section>
    </div>
  );
}

function StreamRow({
  label,
  pct,
  weight,
  tone,
}: {
  label: string;
  pct: number;
  weight: number;
  tone: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">
          {label}{" "}
          <span className="text-xs text-muted">
            · {Math.round(weight * 100)}% of the score
          </span>
        </span>
        <span className="font-semibold tabular-nums">{pct}%</span>
      </div>
      <ProgressBar value={pct} tone={tone} className="mt-1.5" />
    </div>
  );
}
