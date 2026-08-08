"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ACTIVITY_LEVELS,
  AGE_RANGES,
  CUISINES,
  DIET_PREFS,
  EQUIPMENT,
  GOALS,
  SEXES,
} from "@/lib/constants";
import type { User } from "@/generated/prisma/client";

type FormState = {
  name: string;
  ageRange: string;
  sex: string;
  heightCm: string;
  weightKg: string;
  goal: string;
  activityLevel: string;
  dietaryPreference: string;
  cuisine: string;
  allergies: string;
  dislikes: string;
  limitations: string;
  equipment: string;
  wakeTime: string;
  sleepTime: string;
  workoutWindowMin: string;
};

const DEFAULTS: FormState = {
  name: "",
  ageRange: "25-34",
  sex: "other",
  heightCm: "170",
  weightKg: "70",
  goal: "maintain",
  activityLevel: "light",
  dietaryPreference: "vegetarian",
  cuisine: "north_indian",
  allergies: "",
  dislikes: "",
  limitations: "",
  equipment: "none",
  wakeTime: "07:00",
  sleepTime: "23:00",
  workoutWindowMin: "30",
};

function fromUser(user: User): FormState {
  return {
    name: user.name,
    ageRange: user.ageRange,
    sex: user.sex ?? "other",
    heightCm: String(user.heightCm),
    weightKg: String(user.weightKg),
    goal: user.goal,
    activityLevel: user.activityLevel,
    dietaryPreference: user.dietaryPreference,
    cuisine: user.cuisine,
    allergies: user.allergies,
    dislikes: user.dislikes,
    limitations: user.limitations,
    equipment: user.equipment,
    wakeTime: user.wakeTime,
    sleepTime: user.sleepTime,
    workoutWindowMin: String(user.workoutWindowMin),
  };
}

export function ProfileForm({ user }: { user: User | null }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(user ? fromUser(user) : DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          heightCm: Number(form.heightCm),
          weightKg: Number(form.weightKg),
          workoutWindowMin: Number(form.workoutWindowMin),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not save the profile");
        setBusy(false);
        return;
      }
      if (data.notice) setNotice(data.notice);

      router.push("/today");
      router.refresh();
    } catch {
      setError("Network error — is the dev server still running?");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <fieldset className="card p-5">
        <legend className="px-1 text-sm font-bold uppercase tracking-wide text-muted">
          About you
        </legend>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="name">
              What should the coach call you?
            </label>
            <input
              id="name"
              required
              className="input"
              placeholder="Aarav"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>

          <Select
            id="ageRange"
            label="Age range"
            value={form.ageRange}
            onChange={(v) => set("ageRange", v)}
            options={AGE_RANGES.map((a) => ({ value: a, label: a }))}
          />
          <Select
            id="sex"
            label="Sex (used only for energy estimates)"
            value={form.sex}
            onChange={(v) => set("sex", v)}
            options={SEXES}
          />

          <div>
            <label className="label" htmlFor="heightCm">
              Height (cm)
            </label>
            <input
              id="heightCm"
              type="number"
              min={90}
              max={250}
              required
              className="input"
              value={form.heightCm}
              onChange={(e) => set("heightCm", e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="weightKg">
              Weight (kg)
            </label>
            <input
              id="weightKg"
              type="number"
              min={25}
              max={300}
              step="0.1"
              required
              className="input"
              value={form.weightKg}
              onChange={(e) => set("weightKg", e.target.value)}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="card p-5">
        <legend className="px-1 text-sm font-bold uppercase tracking-wide text-muted">
          Goal & routine
        </legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Select
            id="goal"
            label="Main goal"
            value={form.goal}
            onChange={(v) => set("goal", v)}
            options={GOALS}
          />
          <Select
            id="activityLevel"
            label="Current activity level"
            value={form.activityLevel}
            onChange={(v) => set("activityLevel", v)}
            options={ACTIVITY_LEVELS}
          />
          <div>
            <label className="label" htmlFor="wakeTime">
              Wake time
            </label>
            <input
              id="wakeTime"
              type="time"
              className="input"
              value={form.wakeTime}
              onChange={(e) => set("wakeTime", e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="sleepTime">
              Sleep time
            </label>
            <input
              id="sleepTime"
              type="time"
              className="input"
              value={form.sleepTime}
              onChange={(e) => set("sleepTime", e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="workoutWindowMin">
              Minutes available for movement
            </label>
            <input
              id="workoutWindowMin"
              type="number"
              min={10}
              max={180}
              step={5}
              className="input"
              value={form.workoutWindowMin}
              onChange={(e) => set("workoutWindowMin", e.target.value)}
            />
          </div>
          <Select
            id="equipment"
            label="Equipment you actually have"
            value={form.equipment}
            onChange={(v) => set("equipment", v)}
            options={EQUIPMENT}
          />
        </div>
      </fieldset>

      <fieldset className="card p-5">
        <legend className="px-1 text-sm font-bold uppercase tracking-wide text-muted">
          Food preferences
        </legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Select
            id="dietaryPreference"
            label="Dietary preference"
            value={form.dietaryPreference}
            onChange={(v) => set("dietaryPreference", v)}
            options={DIET_PREFS}
          />
          <Select
            id="cuisine"
            label="Cuisine you enjoy"
            value={form.cuisine}
            onChange={(v) => set("cuisine", v)}
            options={CUISINES}
          />
          <div>
            <label className="label" htmlFor="allergies">
              Allergies / must avoid
            </label>
            <input
              id="allergies"
              className="input"
              placeholder="peanuts, shellfish"
              value={form.allergies}
              onChange={(e) => set("allergies", e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="dislikes">
              Foods you dislike
            </label>
            <input
              id="dislikes"
              className="input"
              placeholder="bitter gourd"
              value={form.dislikes}
              onChange={(e) => set("dislikes", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="limitations">
              Physical limitations or things to work around
            </label>
            <textarea
              id="limitations"
              rows={2}
              className="input resize-none"
              placeholder="Desk job, mild knee discomfort on stairs"
              value={form.limitations}
              onChange={(e) => set("limitations", e.target.value)}
            />
            <p className="mt-1.5 text-xs text-muted">
              General wellness context only — WellPath will keep things gentle, and it
              never diagnoses or treats anything.
            </p>
          </div>
        </div>
      </fieldset>

      {error && (
        <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm font-medium text-warn">
          {notice}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Saving…" : user ? "Save profile" : "Create my profile"}
        </button>
        <span className="text-xs text-muted">
          Next step: WellPath builds today&apos;s plan from this.
        </span>
      </div>
    </form>
  );
}

function Select({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
