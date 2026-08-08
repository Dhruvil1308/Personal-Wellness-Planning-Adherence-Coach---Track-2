"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * One-click demo scaffolding: seeds two days of history with a deliberate,
 * readable miss pattern so the adjustment behaviour is visible immediately.
 */
export function DemoControls() {
  const router = useRouter();
  const [busy, setBusy] = useState<"seed" | "reset" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function call(path: string, kind: "seed" | "reset", confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(kind);
    setMessage(null);
    try {
      const res = await fetch(path, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setMessage(
        kind === "seed"
          ? `Seeded ${data.seeded.length} days of history. Today is blank — generate it and watch the plan react.`
          : "Everything cleared.",
      );
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card border-dashed p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">Demo tools</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        Seed two past days where the morning workout and breakfast were missed and
        hydration stalled around half. Then generate today and read the adjustment note.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-ghost"
          disabled={busy !== null}
          onClick={() => call("/api/demo/seed", "seed")}
        >
          {busy === "seed" ? "Seeding 2 days…" : "Seed 2 days of history"}
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={busy !== null}
          onClick={() =>
            call(
              "/api/demo/reset",
              "reset",
              "This deletes the profile and every plan, check-in and summary. Continue?",
            )
          }
        >
          {busy === "reset" ? "Clearing…" : "Reset everything"}
        </button>
      </div>
      {message && <p className="mt-2.5 text-sm font-medium text-brand">{message}</p>}
    </div>
  );
}
