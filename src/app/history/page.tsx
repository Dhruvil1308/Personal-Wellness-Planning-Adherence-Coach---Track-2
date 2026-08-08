import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { computeAdherence, type PlanWithItems } from "@/lib/adherence";
import { prettyDay } from "@/lib/date";
import { EmptyState, ProgressBar, TypeBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

function parseList(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export default async function HistoryPage() {
  const user = await getCurrentUser();
  // Signed out -> the login page. Signed in but no wellness profile yet -> finish it.
  if (!user) redirect("/login");
  if (!user.profileComplete) redirect("/onboarding");

  const plans = await prisma.plan.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
    take: 30,
    include: {
      items: { include: { checkIns: true }, orderBy: { sortOrder: "asc" } },
      summary: true,
      feedback: true,
    },
  });

  if (!plans.length) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <div className="mt-5">
          <EmptyState
            title="No days recorded yet"
            body="Once you generate plans and check in, every day lands here with its summary, its feedback and the adjustment it produced."
            action={
              <Link href="/today" className="btn-primary">
                Go to today
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-7">
      <h1 className="text-2xl font-semibold tracking-tight">History</h1>
      <p className="mt-1 text-sm text-muted">
        Each day, what you actually recorded, and how it changed the next plan.
      </p>

      <ol className="mt-6 space-y-4">
        {plans.map((plan) => {
          const a = computeAdherence(plan as PlanWithItems);
          const wins = plan.summary ? parseList(plan.summary.wins) : [];
          const gaps = plan.summary ? parseList(plan.summary.gaps) : [];

          return (
            <li key={plan.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">
                    {prettyDay(plan.date)}
                  </h2>
                  {plan.focus && (
                    <p className="text-sm text-brand-strong">{plan.focus}</p>
                  )}
                </div>
                <Link href={`/today?date=${plan.date}`} className="btn-ghost py-2">
                  Open
                </Link>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
                <div className="min-w-40 flex-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span>Overall adherence</span>
                    <span className="tabular-nums">{a.overallPct}%</span>
                  </div>
                  <ProgressBar value={a.overallPct} className="mt-1" />
                </div>
                <span className="text-xs text-muted">
                  {a.itemsCompleted}/{a.itemsTotal} items · {a.waterMl}ml water ·{" "}
                  {a.caloriesConsumed} kcal
                </span>
              </div>

              {plan.adjustmentNote && (
                <p className="mt-3 rounded-xl border-l-4 border-brand bg-brand-soft px-3.5 py-2.5 text-sm leading-relaxed text-brand-strong">
                  <span className="font-semibold">Adjusted from the day before: </span>
                  {plan.adjustmentNote}
                </p>
              )}

              {plan.summary && (
                <p className="mt-3 text-sm leading-relaxed">{plan.summary.summaryText}</p>
              )}

              {(wins.length > 0 || gaps.length > 0) && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {wins.map((w) => (
                    <span key={w} className="chip bg-brand-soft text-brand-strong">
                      {w}
                    </span>
                  ))}
                  {gaps.map((g) => (
                    <span key={g} className="chip bg-warn-soft text-warn">
                      {g}
                    </span>
                  ))}
                </div>
              )}

              {plan.feedback && (
                <p className="mt-3 text-xs text-muted">
                  Feedback — energy {plan.feedback.energy}/5, difficulty{" "}
                  {plan.feedback.difficulty}/5, hunger {plan.feedback.hunger}/5
                  {plan.feedback.mood ? `, felt ${plan.feedback.mood}` : ""}
                  {plan.feedback.notes ? ` · “${plan.feedback.notes}”` : ""}
                </p>
              )}

              {(a.missed.length > 0 || a.pending.length > 0) && (
                <div className="mt-3 border-t border-line pt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    Not completed
                  </p>
                  <ul className="mt-1.5 space-y-1.5">
                    {[...a.missed, ...a.pending].map((p) => (
                      <li key={p.item.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <TypeBadge type={p.item.type} />
                        <span>{p.item.title}</span>
                        <span className="text-xs tabular-nums text-muted">
                          {p.item.scheduledTime}
                        </span>
                        <span className="text-xs text-muted">
                          {p.status === "SKIPPED" ? "skipped" : "never logged"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
