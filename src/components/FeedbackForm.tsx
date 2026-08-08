"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Feedback } from "@/generated/prisma/client";

const SCALES = [
  { key: "energy", label: "Energy today", low: "Drained", high: "Great" },
  { key: "difficulty", label: "How hard the plan felt", low: "Easy", high: "Too much" },
  { key: "hunger", label: "Hunger between meals", low: "Satisfied", high: "Very hungry" },
] as const;

const MOODS = ["motivated", "okay", "tired", "stressed", "drained"];

export function FeedbackForm({
  date,
  existing,
}: {
  date: string;
  existing: Feedback | null;
}) {
  const router = useRouter();
  const [energy, setEnergy] = useState(existing?.energy ?? 3);
  const [difficulty, setDifficulty] = useState(existing?.difficulty ?? 3);
  const [hunger, setHunger] = useState(existing?.hunger ?? 3);
  const [mood, setMood] = useState(existing?.mood ?? "okay");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const values: Record<string, [number, (n: number) => void]> = {
    energy: [energy, setEnergy],
    difficulty: [difficulty, setDifficulty],
    hunger: [hunger, setHunger],
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, energy, difficulty, hunger, mood, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save feedback");
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save feedback");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {SCALES.map((s) => {
        const [value, setValue] = values[s.key];
        return (
          <div key={s.key}>
            <div className="flex items-baseline justify-between">
              <span className="label mb-0">{s.label}</span>
              <span className="text-xs tabular-nums text-muted">{value} / 5</span>
            </div>
            <div className="mt-1.5 flex gap-1.5" role="group" aria-label={s.label}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={value === n}
                  onClick={() => setValue(n)}
                  className={`h-9 flex-1 rounded-lg border text-sm font-semibold transition ${
                    value === n
                      ? "border-brand bg-brand text-white"
                      : "border-line bg-surface text-muted hover:bg-brand-soft"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-muted">
              <span>{s.low}</span>
              <span>{s.high}</span>
            </div>
          </div>
        );
      })}

      <div>
        <span className="label">Mood</span>
        <div className="flex flex-wrap gap-1.5">
          {MOODS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mood === m}
              onClick={() => setMood(m)}
              className={`chip border transition ${
                mood === m
                  ? "border-brand bg-brand-soft text-brand-strong"
                  : "border-line bg-surface text-muted hover:bg-brand-soft/60"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="fb-notes">
          Anything the coach should know?
        </label>
        <textarea
          id="fb-notes"
          rows={3}
          maxLength={600}
          className="input resize-none"
          placeholder="Morning workout never happens — I leave for work at 8."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <p className="mt-1.5 text-xs text-muted">
          This text goes straight into tomorrow&apos;s planning prompt.
        </p>
      </div>

      {error && <p className="text-sm font-medium text-danger">{error}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Saving…" : existing ? "Update feedback" : "Save feedback"}
        </button>
        {saved && <span className="text-sm font-medium text-brand">Saved</span>}
      </div>
    </form>
  );
}
