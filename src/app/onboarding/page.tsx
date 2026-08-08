import { ProfileForm } from "@/components/ProfileForm";
import { getCurrentUser } from "@/lib/session";
import { estimateTargets } from "@/lib/nutrition";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  const targets = user ? estimateTargets(user) : null;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="text-2xl font-bold tracking-tight">
        {user ? "Your profile" : "Let's set up your profile"}
      </h1>
      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
        Everything here feeds the planner directly — your schedule, food preferences and
        limitations shape every item WellPath suggests, and each suggestion comes with a
        reason you can read.
      </p>

      {targets && (
        <div className="card mt-5 flex flex-wrap gap-x-8 gap-y-2 p-4 text-sm">
          <Stat label="Estimated maintenance" value={`${targets.maintenanceKcal} kcal`} />
          <Stat label="Daily target" value={`${targets.calorieTarget} kcal`} />
          <Stat label="Protein" value={`${targets.proteinTargetG} g`} />
          <Stat label="Hydration" value={`${targets.hydrationTargetMl} ml`} />
        </div>
      )}

      <div className="mt-6">
        <ProfileForm user={user} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="font-bold tabular-nums">{value}</p>
    </div>
  );
}
