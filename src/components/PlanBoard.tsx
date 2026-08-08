"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Adherence, ItemProgress } from "@/lib/adherence";
import { ProgressBar, streamStyle, TypeBadge, type StreamKey } from "@/components/ui";
import { CheckIcon, CloseIcon, HalfIcon, PlusIcon } from "@/components/icons";

type Props = {
  adherence: Adherence;
  readOnly?: boolean;
};

export function PlanBoard({ adherence: initial, readOnly = false }: Props) {
  const router = useRouter();
  const [adherence, setAdherence] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function send(body: Record<string, unknown>, itemId: string) {
    setPendingId(itemId);
    setError(null);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Check-in failed");
      setAdherence(data.adherence);
      // Refresh so the summary/dashboard panels on this page see the new record.
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check-in failed");
    } finally {
      setPendingId(null);
    }
  }

  async function undo(itemId: string) {
    setPendingId(itemId);
    setError(null);
    try {
      const res = await fetch(`/api/checkin?planItemId=${itemId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not undo");
      setAdherence(data.adherence);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not undo");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <StreamSummary adherence={adherence} />

      {error && (
        <p className="rounded-xl bg-danger-soft px-4 py-2.5 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <ol className="space-y-3">
        {adherence.progress.map((p) => (
          <li key={p.item.id}>
            {p.item.type === "WATER" ? (
              <WaterRow
                p={p}
                busy={pendingId === p.item.id}
                readOnly={readOnly}
                onLog={(ml) =>
                  send({ planItemId: p.item.id, status: "DONE", actualQty: ml }, p.item.id)
                }
                onUndo={() => undo(p.item.id)}
              />
            ) : (
              <TaskRow
                p={p}
                busy={pendingId === p.item.id}
                readOnly={readOnly}
                onStatus={(status, note) =>
                  send({ planItemId: p.item.id, status, note }, p.item.id)
                }
                onUndo={() => undo(p.item.id)}
              />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function StreamSummary({ adherence: a }: { adherence: Adherence }) {
  const rows: { key: StreamKey; pct: number; detail: string }[] = [
    {
      key: "MEAL",
      pct: a.mealPct,
      detail: `${a.caloriesConsumed} kcal logged${a.calorieTarget ? ` of ${a.calorieTarget}` : ""}`,
    },
    { key: "WATER", pct: a.waterPct, detail: `${a.waterMl} / ${a.waterTargetMl} ml` },
    {
      key: "EXERCISE",
      pct: a.exercisePct,
      detail: `${a.progress.filter((p) => p.item.type === "EXERCISE" && p.status === "DONE").length} of ${a.progress.filter((p) => p.item.type === "EXERCISE").length} done`,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {rows.map((r) => {
        const s = streamStyle(r.key);
        return (
          <div key={r.key} className="card p-3.5">
            <div className="flex items-baseline justify-between">
              <span className={`flex items-center gap-1.5 text-xs font-medium ${s.text}`}>
                <s.Icon size={14} />
                {s.label}
              </span>
              <span className="text-sm font-semibold tabular-nums">{r.pct}%</span>
            </div>
            <ProgressBar value={r.pct} tone={s.bg} className="mt-2" />
            <p className="mt-1.5 text-xs text-muted">{r.detail}</p>
          </div>
        );
      })}
    </div>
  );
}

const STATUS_CHIP: Record<string, string> = {
  DONE: "bg-brand-soft text-brand-strong",
  PARTIAL: "bg-warn-soft text-warn",
  SKIPPED: "bg-danger-soft text-danger",
  PENDING: "bg-line/70 text-muted",
};

const STATUS_LABEL: Record<string, string> = {
  DONE: "Done",
  PARTIAL: "Partly done",
  SKIPPED: "Skipped",
  PENDING: "Not logged",
};

function RowShell({
  p,
  children,
  extra,
}: {
  p: ItemProgress;
  children?: React.ReactNode;
  extra?: React.ReactNode;
}) {
  const [showWhy, setShowWhy] = useState(false);
  const s = streamStyle(p.item.type);
  const done = p.status === "DONE";

  return (
    <div
      className={`card p-4 transition ${done ? "border-brand/40 bg-brand-soft/25" : ""}`}
    >
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-14 shrink-0">
          <p className="text-sm font-semibold tabular-nums">{p.item.scheduledTime}</p>
          <p className="text-[11px] capitalize text-muted">
            {p.item.slot ?? s.label}
          </p>
        </div>

        <div className="min-w-52 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold leading-snug">{p.item.title}</h3>
            <TypeBadge type={p.item.type} />
            <span className={`chip ${STATUS_CHIP[p.status]}`}>{STATUS_LABEL[p.status]}</span>
          </div>

          {p.item.details && (
            <p className="mt-1 text-sm leading-relaxed text-muted">{p.item.details}</p>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            {p.item.calories != null && (
              <span className="tabular-nums">{p.item.calories} kcal</span>
            )}
            {p.item.proteinG != null && (
              <span className="tabular-nums">{p.item.proteinG} g protein</span>
            )}
            {p.item.type === "EXERCISE" && p.item.targetQty != null && (
              <span className="tabular-nums">{p.item.targetQty} min</span>
            )}
            {p.item.why && (
              <button
                type="button"
                onClick={() => setShowWhy((v) => !v)}
                className="font-semibold text-brand underline-offset-2 hover:underline"
                aria-expanded={showWhy}
              >
                {showWhy ? "Hide reason" : "Why this?"}
              </button>
            )}
          </div>

          {showWhy && p.item.why && (
            <p className="animate-fade-up mt-2 rounded-xl bg-brand-soft/70 px-3 py-2 text-sm leading-relaxed text-brand-strong">
              {p.item.why}
            </p>
          )}

          {p.note && (
            <p className="mt-2 text-xs italic text-muted">Your note: “{p.note}”</p>
          )}

          {extra}
        </div>

        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">{children}</div>
      </div>
    </div>
  );
}

function TaskRow({
  p,
  busy,
  readOnly,
  onStatus,
  onUndo,
}: {
  p: ItemProgress;
  busy: boolean;
  readOnly: boolean;
  onStatus: (status: string, note?: string) => void;
  onUndo: () => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  if (readOnly) return <RowShell p={p} />;

  return (
    <RowShell
      p={p}
      extra={
        noteOpen ? (
          <div className="animate-fade-up mt-2.5 flex gap-2">
            <input
              className="input py-2 text-sm"
              placeholder="Why was this hard? (feeds tomorrow's plan)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
            />
            <button
              type="button"
              className="btn-ghost shrink-0 py-2"
              disabled={busy}
              onClick={() => {
                onStatus("SKIPPED", note || undefined);
                setNoteOpen(false);
                setNote("");
              }}
            >
              Save
            </button>
          </div>
        ) : null
      }
    >
      <button
        type="button"
        className={`btn ${p.status === "DONE" ? "bg-brand text-white" : "btn-ghost"}`}
        disabled={busy}
        onClick={() => onStatus("DONE")}
      >
        <CheckIcon size={14} />
        Done
      </button>
      <button
        type="button"
        className={`btn ${p.status === "PARTIAL" ? "bg-warn text-white" : "btn-ghost"}`}
        disabled={busy}
        onClick={() => onStatus("PARTIAL")}
      >
        <HalfIcon size={14} />
        Partly
      </button>
      <button
        type="button"
        className={`btn ${p.status === "SKIPPED" ? "bg-danger text-white" : "btn-ghost"}`}
        disabled={busy}
        onClick={() => setNoteOpen((v) => !v)}
      >
        <CloseIcon size={14} />
        Skipped
      </button>
      {p.status !== "PENDING" && (
        <button
          type="button"
          className="text-xs font-semibold text-muted underline-offset-2 hover:underline"
          disabled={busy}
          onClick={onUndo}
        >
          undo
        </button>
      )}
    </RowShell>
  );
}

function WaterRow({
  p,
  busy,
  readOnly,
  onLog,
  onUndo,
}: {
  p: ItemProgress;
  busy: boolean;
  readOnly: boolean;
  onLog: (ml: number) => void;
  onUndo: () => void;
}) {
  const target = p.item.targetQty ?? 0;
  const logged = p.loggedQty ?? 0;
  const glasses = Math.max(1, Math.round(target / 250));
  const filled = Math.min(glasses, Math.round(logged / 250));

  return (
    <RowShell
      p={p}
      extra={
        <div className="mt-2.5">
          <div className="flex items-center gap-2">
            <ProgressBar value={target ? (logged / target) * 100 : 0} tone="bg-water" />
            <span className="shrink-0 text-xs font-semibold tabular-nums text-water">
              {Math.round(logged)} / {Math.round(target)} ml
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1" aria-hidden>
            {Array.from({ length: glasses }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-5 rounded-full transition ${
                  i < filled ? "bg-water" : "bg-line"
                }`}
              />
            ))}
          </div>
        </div>
      }
    >
      {!readOnly && (
        <>
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={() => onLog(250)}
          >
            <PlusIcon size={13} />
            250 ml
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={() => onLog(500)}
          >
            <PlusIcon size={13} />
            500 ml
          </button>
          {p.checkInCount > 0 && (
            <button
              type="button"
              className="text-xs font-semibold text-muted underline-offset-2 hover:underline"
              disabled={busy}
              onClick={onUndo}
            >
              reset
            </button>
          )}
        </>
      )}
    </RowShell>
  );
}
