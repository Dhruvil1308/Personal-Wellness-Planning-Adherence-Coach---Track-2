"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GeneratePlanButton({
  date,
  force = false,
  label,
  className = "btn-primary",
}: {
  date: string;
  force?: boolean;
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (force && !confirm("Regenerating replaces this day's plan and clears its check-ins. Continue?"))
      return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, force }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not generate the plan");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate the plan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button type="button" onClick={run} disabled={busy} className={className}>
        {busy ? "Thinking…" : label}
      </button>
      {error && <span className="text-xs font-medium text-danger">{error}</span>}
    </div>
  );
}
