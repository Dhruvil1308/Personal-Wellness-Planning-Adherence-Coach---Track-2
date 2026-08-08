"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { streamStyle } from "@/components/ui";
import { BellIcon, PhoneIcon, PlayIcon, PlusIcon, STREAM_ICONS } from "@/components/icons";

export type ReminderRow = {
  id: string;
  date: string;
  scheduledAt: string;
  kind: string;
  status: string;
  script: string;
  scriptBy: string;
  title: string | null;
  note: string | null;
  repeat: string;
  transcript: string | null;
  failureReason: string | null;
  durationSec: number | null;
  attempts: number;
  item: { title: string; type: string; scheduledTime: string; slot: string | null } | null;
};

export type VoiceReadiness = {
  ready: boolean;
  reason?: string;
  baseUrl: string | null;
  hasVobiz: boolean;
  hasSarvam: boolean;
};

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  SCHEDULED: { label: "Scheduled", className: "bg-line/70 text-muted" },
  DISPATCHING: { label: "Dialling…", className: "bg-warn-soft text-warn" },
  RINGING: { label: "Ringing", className: "bg-warn-soft text-warn" },
  ANSWERED: { label: "Speaking", className: "bg-brand-soft text-brand-strong" },
  COMPLETED: { label: "Reminded", className: "bg-brand-soft text-brand-strong" },
  FAILED: { label: "Failed", className: "bg-danger-soft text-danger" },
  CANCELLED: { label: "Cancelled", className: "bg-line/70 text-muted" },
  SKIPPED: { label: "Skipped — already done", className: "bg-brand-soft text-brand-strong" },
  EXPIRED: { label: "Missed its window", className: "bg-warn-soft text-warn" },
};

function clockOf(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function RemindersPanel({
  date,
  initialReminders,
  settings,
  readiness,
}: {
  date: string;
  initialReminders: ReminderRow[];
  settings: { phone: string | null; remindersEnabled: boolean; reminderLanguage: string };
  readiness: VoiceReadiness;
}) {
  const router = useRouter();
  const [reminders, setReminders] = useState(initialReminders);
  const [phone, setPhone] = useState(settings.phone ?? "");
  const [enabled, setEnabled] = useState(settings.remindersEnabled);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ id: string; script: string; by: string } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const previewCount = useRef(0);

  async function saveSettings(next: { phone?: string; remindersEnabled?: boolean }) {
    setBusy("settings");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, ...next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      setReminders(data.reminders);
      if (next.remindersEnabled !== undefined) setEnabled(next.remindersEnabled);
      setMessage(
        data.sync.created || data.sync.updated
          ? `${data.sync.created + data.sync.updated} reminder call${
              data.sync.created + data.sync.updated === 1 ? "" : "s"
            } scheduled from today's plan.`
          : "Saved.",
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(null);
    }
  }

  async function act(id: string, action: "call-now" | "cancel" | "reschedule" | "preview") {
    if (action === "call-now" && !confirm("Place a real phone call to this number now?")) return;

    setBusy(id + action);
    setError(null);
    setMessage(null);
    setPreview(null);
    try {
      const res = await fetch(`/api/reminders/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");

      if (action === "preview") {
        setPreview({ id, script: data.script, by: data.scriptBy });
        // Cache-bust so a re-preview plays the newly rendered audio rather than
        // whatever the browser already has for this reminder id.
        previewCount.current += 1;
        if (audioRef.current) {
          audioRef.current.src = `${data.audioUrl}?v=${previewCount.current}`;
          await audioRef.current.play().catch(() => {});
        }
        setMessage(
          `Rendered ${data.bytes.toLocaleString()} bytes of ${data.language} audio with a ${data.leadSilenceSeconds}s lead pause. No call was placed.`,
        );
      } else if (action === "call-now") {
        setMessage(data.outcome.detail);
      }

      const refreshed = await fetch(`/api/reminders?date=${date}`).then((r) => r.json());
      if (refreshed.reminders) setReminders(refreshed.reminders);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  const upcoming = reminders.filter((r) => r.status === "SCHEDULED").length;

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted">
        WellPath rings you in <strong className="text-foreground">Gujarati</strong> at each
        scheduled time. The agent waits two seconds after you pick up, reads the reminder,
        then hangs up on its own — no menus, nothing to press.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label className="label" htmlFor="reminder-phone">
            Phone number
          </label>
          <input
            id="reminder-phone"
            className="input"
            inputMode="tel"
            placeholder="+919824100246"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => phone !== (settings.phone ?? "") && saveSettings({ phone })}
          />
        </div>
        <button
          type="button"
          className={enabled ? "btn bg-brand text-white" : "btn-ghost"}
          disabled={busy !== null || (!phone && !enabled)}
          onClick={() => saveSettings({ phone, remindersEnabled: !enabled })}
        >
          {busy === "settings" ? "Saving…" : enabled ? "Calls on" : "Turn calls on"}
        </button>
      </div>

      {!readiness.ready && (
        <div className="rounded-xl bg-warn-soft px-3.5 py-3 text-sm leading-relaxed text-warn">
          <p className="font-semibold">Calls are on hold</p>
          <p className="mt-1">{readiness.reason}</p>
          <p className="mt-1.5">
            Everything else works meanwhile — <strong>Preview</strong> renders the Gujarati
            audio and plays it right here in the browser.
          </p>
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-xl bg-brand-soft px-3.5 py-2.5 text-sm font-medium text-brand-strong">
          {message}
        </p>
      )}

      {/* Synthesised speech preview; the spoken text is printed below it. */}
      <audio ref={audioRef} className="w-full" controls preload="none" />

      {preview && (
        <div className="animate-fade-up rounded-xl border border-line bg-background px-3.5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            What the agent will say {preview.by === "ai" ? "(AI written)" : "(template)"}
          </p>
          <p className="mt-1.5 text-[15px] leading-relaxed" lang="gu">
            {preview.script}
          </p>
        </div>
      )}

      <CustomCallForm
        date={date}
        disabled={!phone}
        onScheduled={(list) => {
          setReminders(list);
          setMessage("Call scheduled.");
          router.refresh();
        }}
        onError={setError}
      />

      {reminders.length === 0 ? (
        <p className="text-sm text-muted">
          No calls scheduled yet. Add your number and switch calls on — every item in
          today&apos;s plan gets one, and you can add your own above.
        </p>
      ) : (
        <>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            {upcoming} upcoming of {reminders.length} today
          </p>
          <ul className="divide-y divide-line">
            {reminders.map((r) => {
              const style = STATUS_STYLE[r.status] ?? {
                label: r.status,
                className: "bg-line/70 text-muted",
              };
              const kind = r.item?.type ?? r.kind;
              const StreamIcon =
                STREAM_ICONS[kind as keyof typeof STREAM_ICONS] ?? BellIcon;
              const stream = streamStyle(kind);
              const live = r.status === "SCHEDULED" || r.status === "EXPIRED" || r.status === "CANCELLED";

              return (
                <li key={r.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">
                      {clockOf(r.scheduledAt)}
                    </span>
                    <StreamIcon size={15} className={stream.text} />
                    <span className="text-sm font-medium">
                      {r.item?.title ?? r.title ?? r.kind}
                    </span>
                    {!r.item && (
                      <span className="chip bg-line/70 text-muted">
                        yours{r.repeat === "DAILY" ? " · daily" : ""}
                      </span>
                    )}
                    <span className={`chip ${style.className}`}>{style.label}</span>

                    <span className="ml-auto flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        className="chip border border-line bg-surface text-muted hover:bg-brand-soft"
                        disabled={busy !== null}
                        onClick={() => act(r.id, "preview")}
                      >
                        {busy === r.id + "preview" ? (
                          "Rendering…"
                        ) : (
                          <>
                            <PlayIcon size={12} />
                            Preview
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        className="chip border border-line bg-surface text-muted hover:bg-brand-soft disabled:opacity-50"
                        disabled={busy !== null || !readiness.ready}
                        title={readiness.ready ? undefined : readiness.reason}
                        onClick={() => act(r.id, "call-now")}
                      >
                        {busy === r.id + "call-now" ? (
                          "Calling…"
                        ) : (
                          <>
                            <PhoneIcon size={12} />
                            Call now
                          </>
                        )}
                      </button>
                      {live ? (
                        r.status === "SCHEDULED" ? (
                          <button
                            type="button"
                            className="chip text-muted hover:text-danger"
                            disabled={busy !== null}
                            onClick={() => act(r.id, "cancel")}
                          >
                            cancel
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="chip text-muted hover:text-brand"
                            disabled={busy !== null}
                            onClick={() => act(r.id, "reschedule")}
                          >
                            restore
                          </button>
                        )
                      ) : null}
                    </span>
                  </div>

                  {r.script && (
                    <p className="mt-1.5 text-sm leading-relaxed text-muted" lang="gu">
                      {r.script}
                    </p>
                  )}
                  {r.transcript && (
                    <p className="mt-1 text-xs italic text-muted" lang="gu">
                      You said: “{r.transcript}”
                    </p>
                  )}
                  {r.failureReason && r.status !== "SKIPPED" && (
                    <p className="mt-1 text-xs text-danger">{r.failureReason}</p>
                  )}
                  {r.durationSec != null && (
                    <p className="mt-1 text-xs text-muted">Call lasted {r.durationSec}s</p>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

const KINDS = [
  { value: "WATER", label: "Water" },
  { value: "MEAL", label: "Meal" },
  { value: "EXERCISE", label: "Movement" },
  { value: "CUSTOM", label: "Something else" },
];

/** Schedule a call at a time you pick, independent of the generated plan. */
function CustomCallForm({
  date,
  disabled,
  onScheduled,
  onError,
}: {
  date: string;
  disabled: boolean;
  onScheduled: (reminders: ReminderRow[]) => void;
  onError: (message: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState("09:00");
  const [kind, setKind] = useState("WATER");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [repeat, setRepeat] = useState("ONCE");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    onError(null);
    try {
      const res = await fetch("/api/reminders/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, time, kind, title, note, repeat }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not schedule the call");

      const refreshed = await fetch(`/api/reminders?date=${date}`).then((r) => r.json());
      onScheduled(refreshed.reminders ?? []);
      setTitle("");
      setNote("");
      setOpen(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not schedule the call");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn-ghost w-full border-dashed"
        disabled={disabled}
        title={disabled ? "Add your mobile number first" : undefined}
        onClick={() => setOpen(true)}
      >
        <PlusIcon size={15} />
        Schedule a call at a specific time
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="animate-fade-up space-y-3 rounded-xl border border-line bg-background p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        Schedule your own call
      </p>

      <div className="flex flex-wrap gap-3">
        <div className="w-28">
          <label className="label" htmlFor="custom-time">
            Time
          </label>
          <input
            id="custom-time"
            type="time"
            required
            className="input"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
        <div className="min-w-36 flex-1">
          <label className="label" htmlFor="custom-kind">
            About
          </label>
          <select
            id="custom-kind"
            className="input"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div className="w-32">
          <label className="label" htmlFor="custom-repeat">
            Repeat
          </label>
          <select
            id="custom-repeat"
            className="input"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
          >
            <option value="ONCE">Once</option>
            <option value="DAILY">Every day</option>
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="custom-title">
          What should the call be about?
        </label>
        <input
          id="custom-title"
          required
          maxLength={80}
          className="input"
          placeholder="Drink a glass of water"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="custom-note">
          Anything to add? <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="custom-note"
          maxLength={300}
          className="input"
          placeholder="Before the afternoon meeting"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <p className="mt-1.5 text-xs text-muted">
          WellPath turns this into a natural Gujarati line — it does not read it back
          word for word.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Scheduling…" : "Schedule call"}
        </button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
