import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import {
  ChecklistIcon,
  CompassIcon,
  PhoneIcon,
  RefreshIcon,
  UserIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    Icon: UserIcon,
    title: "Sign up and tell it about your day",
    body: "A username, a password and your mobile number, then age range, height, weight, goal, diet, allergies, limitations, and how many minutes you really have.",
  },
  {
    Icon: CompassIcon,
    title: "Get an explainable plan",
    body: "Meals, hydration and movement, each scheduled around your routine — and each with a plain reason you can read.",
  },
  {
    Icon: ChecklistIcon,
    title: "Check in as you go",
    body: "Done, partly done or skipped. Log water a glass at a time. Add a note when something did not fit.",
  },
  {
    Icon: RefreshIcon,
    title: "Tomorrow adapts",
    body: "The next plan is written from your completion record and feedback. What you missed comes back moved, smaller or swapped — never just repeated.",
  },
  {
    Icon: PhoneIcon,
    title: "And it calls you",
    body: "At each scheduled time WellPath rings your mobile and delivers the reminder in Gujarati — two seconds after you pick up, then it hangs up on its own.",
  },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect(user.profileComplete ? "/today" : "/onboarding");

  return (
    <div className="mx-auto max-w-5xl px-5 py-14">
      <span className="chip bg-brand-soft text-brand-strong">
        Health &amp; wellness · social impact
      </span>

      <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-[-0.02em] sm:text-[52px]">
        A wellness plan that changes when your{" "}
        <span className="text-brand">real day</span> does.
      </h1>

      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
        Generic plans ignore your schedule, your preferences and what you actually
        managed. WellPath builds a personalised routine, runs daily check-ins, and
        rewrites tomorrow from the record — with a reason attached to every choice.
      </p>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <Link href="/register" className="btn-primary px-5 py-3 text-base">
          Create your account
        </Link>
        <Link href="/login" className="btn-ghost px-5 py-3 text-base">
          Sign in
        </Link>
      </div>

      <ol className="mt-12 grid gap-4 sm:grid-cols-2">
        {STEPS.map((s, i) => (
          <li key={s.title} className="card p-5">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand-strong">
                <s.Icon size={17} />
              </span>
              <span className="text-xs font-medium uppercase tracking-wide text-muted">
                Step {i + 1}
              </span>
            </div>
            <h2 className="mt-2.5 text-base font-semibold">{s.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{s.body}</p>
          </li>
        ))}
      </ol>

      <p className="mt-10 rounded-2xl border border-line bg-surface px-5 py-4 text-sm leading-relaxed text-muted">
        <strong className="text-foreground">What WellPath will not do.</strong> It does
        not diagnose anything, prescribe or adjust medication, or claim to replace a
        doctor, dietitian or physiotherapist. Plans stay in general wellness territory —
        everyday food, water, movement and routine — and anything that sounds urgent gets
        pointed at a real professional instead of an app.
      </p>
    </div>
  );
}
