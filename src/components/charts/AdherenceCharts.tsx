"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendPoint } from "@/lib/services/insights";

/**
 * Two charts, deliberately separate:
 *  - "Daily adherence" is ONE series, so it needs no legend and can wear the
 *    brand hue plus a status tint at the extremes.
 *  - "By stream" is three categorical series and uses the validated
 *    meal/water/exercise trio, which is why those hues never mix into chart 1.
 */

const AXIS = { fontSize: 11, fill: "var(--muted)" };
const GRID = "var(--line)";

function toneFor(pct: number) {
  return pct >= 80
    ? "var(--brand)"
    : pct >= 55
      ? "var(--warn)"
      : "var(--danger)";
}

type TooltipRow = { name: string; value: number; color: string };

function ChartTooltip({
  active,
  label,
  rows,
  suffix = "%",
}: {
  active?: boolean;
  label?: string;
  rows: TooltipRow[];
  suffix?: string;
}) {
  if (!active || !rows.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-lg">
      <p className="text-xs font-medium">{label}</p>
      <ul className="mt-1 space-y-0.5">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: r.color }}
            />
            <span className="text-muted">{r.name}</span>
            <span className="ml-auto font-semibold tabular-nums">
              {r.value}
              {suffix}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdherenceTrendChart({ trend }: { trend: TrendPoint[] }) {
  const data = trend.filter((t) => t.hasPlan);
  const [showTable, setShowTable] = useState(false);

  if (!data.length) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        No days recorded yet — generate a plan and check in to start the trend.
      </p>
    );
  }

  return (
    <div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 16, right: 8, bottom: 0, left: -18 }}
          >
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="label"
              tick={AXIS}
              tickLine={false}
              axisLine={{ stroke: GRID }}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={AXIS}
              tickLine={false}
              axisLine={false}
              unit="%"
            />
            <Tooltip
              cursor={{ fill: "var(--brand-soft)", opacity: 0.5 }}
              content={({ active, label, payload }) => (
                <ChartTooltip
                  active={active}
                  label={String(label ?? "")}
                  rows={
                    payload?.length
                      ? [
                          {
                            name: "Adherence",
                            value: Number(payload[0].value ?? 0),
                            color: toneFor(Number(payload[0].value ?? 0)),
                          },
                        ]
                      : []
                  }
                />
              )}
            />
            <Bar dataKey="overallPct" maxBarSize={24} radius={[4, 4, 0, 0]}>
              {data.map((d) => (
                <Cell key={d.date} fill={toneFor(d.overallPct)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
        <Key color="var(--brand)" label="80%+ on plan" />
        <Key color="var(--warn)" label="55–79%" />
        <Key color="var(--danger)" label="under 55%" />
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="ml-auto font-semibold text-brand underline-offset-2 hover:underline"
          aria-expanded={showTable}
        >
          {showTable ? "Hide table" : "View as table"}
        </button>
      </div>

      {showTable && (
        <div className="animate-fade-up mt-3 overflow-x-auto">
          <table className="w-full min-w-md text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-3 font-semibold">Day</th>
                <th className="py-2 pr-3 text-right font-semibold">Overall</th>
                <th className="py-2 pr-3 text-right font-semibold">Meals</th>
                <th className="py-2 pr-3 text-right font-semibold">
                  Hydration
                </th>
                <th className="py-2 pr-3 text-right font-semibold">Movement</th>
                <th className="py-2 text-right font-semibold">Items</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date} className="border-b border-line/60">
                  <td className="py-2 pr-3">{d.label}</td>
                  <td className="py-2 pr-3 text-right font-semibold tabular-nums">
                    {d.overallPct}%
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {d.mealPct}%
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {d.waterPct}%
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {d.exercisePct}%
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {d.itemsCompleted}/{d.itemsTotal}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const STREAMS = [
  { key: "mealPct", name: "Meals", color: "var(--meal)" },
  { key: "waterPct", name: "Hydration", color: "var(--water)" },
  { key: "exercisePct", name: "Movement", color: "var(--exercise)" },
] as const;

export function StreamChart({ trend }: { trend: TrendPoint[] }) {
  const data = trend.filter((t) => t.hasPlan);
  if (!data.length) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        Nothing to compare yet — check in on a plan first.
      </p>
    );
  }

  return (
    <div>
      {/* Hand-rolled legend rather than recharts' own, so its order always
          matches the bar order instead of render-completion order. */}
      <ul className="mb-1 flex flex-wrap gap-x-4 gap-y-1">
        {STREAMS.map((s) => (
          <li
            key={s.key}
            className="flex items-center gap-1.5 text-xs text-muted"
          >
            <span
              aria-hidden
              className="h-2 w-2 rounded-full"
              style={{ background: s.color }}
            />
            {s.name}
          </li>
        ))}
      </ul>

      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            barGap={2}
            barCategoryGap="22%"
            margin={{ top: 8, right: 8, bottom: 0, left: -18 }}
          >
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="label"
              tick={AXIS}
              tickLine={false}
              axisLine={{ stroke: GRID }}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 50, 100]}
              tick={AXIS}
              tickLine={false}
              axisLine={false}
              unit="%"
            />
            <Tooltip
              cursor={{ fill: "var(--brand-soft)", opacity: 0.4 }}
              content={({ active, label, payload }) => (
                <ChartTooltip
                  active={active}
                  label={String(label ?? "")}
                  rows={STREAMS.map((s) => ({
                    name: s.name,
                    value: Number(
                      payload?.find((p) => p.dataKey === s.key)?.value ?? 0,
                    ),
                    color: s.color,
                  }))}
                />
              )}
            />
            {STREAMS.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                fill={s.color}
                maxBarSize={16}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        aria-hidden
        className="h-2 w-2 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
