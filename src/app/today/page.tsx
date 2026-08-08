import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getPlan } from "@/lib/services/plans";
import { getGateStatus } from "@/lib/services/planGate";
import { computeAdherence, type PlanWithItems } from "@/lib/adherence";
import { isValidDayKey, prettyDay, shiftDay, today as todayKey } from "@/lib/date";
import { PlanBoard } from "@/components/PlanBoard";
import { GeneratePlanButton } from "@/components/GeneratePlanButton";
import { FeedbackForm } from "@/components/FeedbackForm";
import { SummaryPanel } from "@/components/SummaryPanel";
import { CoachChat } from "@/components/CoachChat";
import { DemoControls } from "@/components/DemoControls";
import { PlanLockCard } from "@/components/PlanLockCard";
import { RemindersPanel } from "@/components/RemindersPanel";
import { checkVoiceReadiness } from "@/lib/voice/config";
import { AdherenceRing, EmptyState, SectionTitle } from "@/components/ui";
import { ArrowLeftIcon, ArrowRightIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function TodayPage({ searchParams }: PageProps<"/today">) {
  const user = await getCurrentUser();
  // Signed out -> the login page. Signed in but no wellness profile yet -> finish it.
  if (!user) redirect("/login");
  if (!user.profileComplete) redirect("/onboarding");

  const sp = await searchParams;
  const raw = typeof sp.date === "string" ? sp.date : undefined;
  const date = raw && isValidDayKey(raw) ? raw : todayKey();
  const isToday = date === todayKey();

  const plan = await getPlan(user.id, date);
  const gate = await getGateStatus(user.id, date);
  const adherence = plan ? computeAdherence(plan as PlanWithItems) : null;

  const messages = await prisma.coachMessage.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    take: 30,
  });

  const yesterdayPlan = await prisma.plan.findUnique({
    where: { userId_date: { userId: user.id, date: shiftDay(date, -1) } },
    include: { summary: true },
  });

  const reminders = await prisma.reminder.findMany({
    where: { userId: user.id, date },
    orderBy: { scheduledAt: "asc" },
    include: {
      item: { select: { title: true, type: true, scheduledTime: true, slot: true } },
    },
  });
  const readiness = checkVoiceReadiness();

  return (
    <div className="mx-auto max-w-6xl px-5 py-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            {isToday ? "Today" : "Plan for"}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{prettyDay(date)}</h1>
          {plan?.focus && (
            <p className="mt-1 text-[15px] font-medium text-brand-strong">{plan.focus}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/today?date=${shiftDay(date, -1)}`} className="btn-ghost">
            <ArrowLeftIcon size={15} />
            Previous day
          </Link>
          {!isToday && (
            <Link href="/today" className="btn-ghost">
              Back to today
            </Link>
          )}
          {plan && <GeneratePlanButton date={date} force label="Regenerate" className="btn-ghost" />}
        </div>
      </header>

      {!plan || !gate.unlocked ? (
        <div className="mt-6 space-y-4">
          {gate.unlocked ? (
            <EmptyState
              title={`No plan for ${prettyDay(date)} yet`}
              body={
                yesterdayPlan
                  ? "WellPath will read yesterday's check-ins and feedback before it writes this one — anything you missed will visibly change."
                  : "WellPath will build a full day of meals, hydration and movement from your profile, and explain every choice."
              }
              action={<GeneratePlanButton date={date} label="Generate this plan" />}
            />
          ) : (
            <PlanLockCard date={date} gate={gate} />
          )}
          <DemoControls />
        </div>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-5">
            <section className="card p-5">
              <SectionTitle
                title="Why this plan"
                hint="Every plan is explainable — this is the reasoning behind today."
              />
              <p className="text-[15px] leading-relaxed">{plan.rationale}</p>

              {plan.adjustmentNote && (
                <div className="mt-4 rounded-xl border-l-4 border-brand bg-brand-soft px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-brand-strong">
                    What changed since {prettyDay(shiftDay(date, -1))}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-brand-strong">
                    {plan.adjustmentNote}
                  </p>
                </div>
              )}

              <dl className="mt-4 flex flex-wrap gap-x-7 gap-y-2 border-t border-line pt-3.5 text-sm">
                <Target label="Energy target" value={plan.calorieTarget ? `${plan.calorieTarget} kcal` : "—"} />
                <Target label="Protein" value={plan.proteinTargetG ? `${plan.proteinTargetG} g` : "—"} />
                <Target label="Hydration" value={`${plan.hydrationTargetMl} ml`} />
              </dl>
            </section>

            {plan.coachMessage && (
              <p className="rounded-2xl bg-brand px-5 py-4 text-[15px] font-medium leading-relaxed text-white">
                {plan.coachMessage}
              </p>
            )}

            <section>
              <SectionTitle
                title="Check in as you go"
                hint="Every tap here is what tomorrow's plan gets built from."
                right={adherence ? <AdherenceRing pct={adherence.overallPct} size={76} label="today" /> : null}
              />
              <PlanBoard adherence={adherence!} readOnly={false} />
            </section>
          </div>

          <div className="space-y-5">
            <section className="card p-5">
              <SectionTitle title="Coach" hint="Supportive, grounded in your record." />
              <CoachChat
                initial={messages.map((m) => ({ role: m.role, content: m.content }))}
              />
            </section>

            <section className="card p-5">
              <SectionTitle
                title="Reminder calls"
                hint="Gujarati voice call at each scheduled time."
                right={
                  <span
                    className={`chip ${
                      user.remindersEnabled
                        ? "bg-brand-soft text-brand-strong"
                        : "bg-line/70 text-muted"
                    }`}
                  >
                    {user.remindersEnabled ? "● On" : "○ Off"}
                  </span>
                }
              />
              <RemindersPanel
                date={date}
                initialReminders={reminders.map((r) => ({
                  ...r,
                  scheduledAt: r.scheduledAt.toISOString(),
                }))}
                settings={{
                  phone: user.phone,
                  remindersEnabled: user.remindersEnabled,
                  reminderLanguage: user.reminderLanguage,
                }}
                readiness={readiness}
              />
            </section>

            <section className="card p-5">
              <SectionTitle
                title="End-of-day summary"
                hint="Built from recorded check-ins only."
              />
              <SummaryPanel
                date={date}
                summary={plan.summary}
                itemsPending={adherence?.itemsPending ?? 0}
              />
            </section>

            <section className="card p-5">
              <SectionTitle
                title="How did the day feel?"
                hint="Feeds directly into the next plan."
              />
              <FeedbackForm date={date} existing={plan.feedback} />
            </section>

            <section className="card p-5">
              <SectionTitle title="Ready for tomorrow?" />
              <p className="text-sm leading-relaxed text-muted">
                Build{" "}
                <strong className="text-foreground">{prettyDay(shiftDay(date, 1))}</strong>{" "}
                using today&apos;s completion record and feedback. Anything you missed will
                come back changed, not repeated.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <GeneratePlanButton
                  date={shiftDay(date, 1)}
                  force
                  label="Generate tomorrow's plan"
                />
                <Link href={`/today?date=${shiftDay(date, 1)}`} className="btn-ghost">
                  View it
                  <ArrowRightIcon size={15} />
                </Link>
              </div>
            </section>

            <DemoControls />
          </div>
        </div>
      )}
    </div>
  );
}

function Target({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
