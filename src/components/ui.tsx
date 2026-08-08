import type { ReactNode } from "react";
import { STREAM_ICONS } from "@/components/icons";

export const STREAM_STYLE = {
  MEAL: {
    label: "Meal",
    text: "text-meal",
    bg: "bg-meal",
    soft: "bg-meal-soft",
    Icon: STREAM_ICONS.MEAL,
  },
  WATER: {
    label: "Hydration",
    text: "text-water",
    bg: "bg-water",
    soft: "bg-water-soft",
    Icon: STREAM_ICONS.WATER,
  },
  EXERCISE: {
    label: "Movement",
    text: "text-exercise",
    bg: "bg-exercise",
    soft: "bg-exercise-soft",
    Icon: STREAM_ICONS.EXERCISE,
  },
} as const;

export type StreamKey = keyof typeof STREAM_STYLE;

export function streamStyle(type: string) {
  return STREAM_STYLE[type as StreamKey] ?? STREAM_STYLE.MEAL;
}

export function TypeBadge({ type }: { type: string }) {
  const s = streamStyle(type);
  return (
    <span className={`chip ${s.soft} ${s.text}`}>
      <s.Icon size={13} />
      {s.label}
    </span>
  );
}

export function ProgressBar({
  value,
  tone = "bg-brand",
  className = "",
}: {
  value: number;
  tone?: string;
  className?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-line ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${tone}`}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

export function StatTile({
  label,
  value,
  sub,
  tone = "bg-brand",
  pct,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: string;
  pct?: number;
}) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold">{value}</p>
      {pct !== undefined && <ProgressBar value={pct} tone={tone} className="mt-2.5" />}
      {sub && <p className="mt-2 text-xs leading-relaxed text-muted">{sub}</p>}
    </div>
  );
}

/** Circular adherence gauge — the headline number on the dashboard. */
export function AdherenceRing({
  pct,
  size = 132,
  label = "adherence",
}: {
  pct: number;
  size?: number;
  label?: string;
}) {
  const v = Math.max(0, Math.min(100, pct));
  const stroke = size < 90 ? 8 : 11;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const color = v >= 80 ? "var(--brand)" : v >= 55 ? "var(--warn)" : "var(--danger)";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={`${v}% ${label}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--line)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * circ} ${circ}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dasharray 600ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p
            className="font-semibold leading-none"
            style={{ fontSize: size < 90 ? 17 : 26 }}
          >
            {Math.round(v)}%
          </p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}

export function SectionTitle({
  title,
  hint,
  right,
}: {
  title: string;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {hint && <p className="mt-0.5 text-sm leading-relaxed text-muted">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="card grid place-items-center p-10 text-center">
      <div className="max-w-md">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
        {action && <div className="mt-4 flex justify-center">{action}</div>}
      </div>
    </div>
  );
}
