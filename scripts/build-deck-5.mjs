/**
 * The 5-slide finalist deck: Problem & user · AI approach · Live demo ·
 * Architecture · Impact & limits.
 *
 *   node scripts/build-deck-5.mjs
 *
 * Minimalist on purpose — one idea per slide, carried by a diagram rather than
 * bullets. Quoted AI output is real, taken from dev.db.
 */
import PptxGenJS from "pptxgenjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "WellPath-AI-Finalist-5.pptx",
);

const C = {
  ink: "17211C",
  body: "3A4741",
  muted: "6B7A72",
  line: "E4E8E2",
  bg: "F7F8F5",
  surface: "FFFFFF",
  brand: "1F6F4A",
  brandDeep: "0F3D28",
  brandSoft: "E8F2EC",
  meal: "C2703B",
  water: "2B7FA8",
  exercise: "9C3F6D",
  warn: "9A6A17",
  danger: "B4452F",
  white: "FFFFFF",
};

const F = "Segoe UI";
const W = 13.333;
const H = 7.5;

const pptx = new PptxGenJS();
pptx.defineLayout({ name: "WIDE", width: W, height: H });
pptx.layout = "WIDE";
pptx.title = "WellPath AI — Finalist Presentation";
pptx.company = "Hack The Stack — August 2026";

const text = (s, str, o) =>
  s.addText(str, { fontFace: F, color: C.body, valign: "top", ...o });

const card = (s, x, y, w, h, o = {}) =>
  s.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    rectRadius: o.radius ?? 0.08,
    fill: { color: o.fill ?? C.surface },
    line: { color: o.border ?? C.line, width: o.borderWidth ?? 1 },
    shadow: { type: "outer", blur: 0, offset: 0, opacity: 0 },
  });

/** Big number in the corner is the only chrome — keeps the slides quiet. */
function slide(n, eyebrow, title) {
  const s = pptx.addSlide();
  s.background = { color: C.bg };

  text(s, `0${n}`, {
    x: 0.7, y: 0.52, w: 1.2, h: 0.7,
    fontSize: 34, bold: true, color: "D3DCD6",
  });
  text(s, eyebrow.toUpperCase(), {
    x: 1.55, y: 0.62, w: 8, h: 0.26,
    fontSize: 10.5, bold: true, color: C.brand, charSpacing: 1.6,
  });
  text(s, title, {
    x: 1.52, y: 0.88, w: 11.2, h: 0.55, fontSize: 27, bold: true, color: C.ink,
  });
  s.addShape(pptx.ShapeType.rect, {
    x: 0.72, y: 6.86, w: 0.55, h: 0.035, fill: { color: C.brand }, line: { width: 0 },
  });
  text(s, "WellPath AI", {
    x: 1.45, y: 6.72, w: 3, h: 0.28, fontSize: 9.5, color: C.muted,
  });
  return s;
}

/* ═══════════════════════════════════════════════ 01 · problem & user */
{
  const s = slide(1, "Problem & user", "The plan is not the problem. The loop is.");

  // The persona
  card(s, 0.72, 1.78, 4.05, 4.5);
  s.addShape(pptx.ShapeType.ellipse, {
    x: 1.05, y: 2.1, w: 0.82, h: 0.82, fill: { color: C.brandSoft }, line: { width: 0 },
  });
  text(s, "A", {
    x: 1.05, y: 2.28, w: 0.82, h: 0.42, fontSize: 22, bold: true,
    color: C.brand, align: "center",
  });
  text(s, "Aarav, 31", {
    x: 1.05, y: 3.06, w: 3.4, h: 0.36, fontSize: 19, bold: true, color: C.ink,
  });
  text(s, "Desk job · vegetarian · mild knee pain\n25 minutes free a day", {
    x: 1.05, y: 3.48, w: 3.4, h: 0.62, fontSize: 12, color: C.muted, lineSpacing: 17,
  });

  s.addShape(pptx.ShapeType.rect, {
    x: 1.05, y: 4.28, w: 3.4, h: 0.02, fill: { color: C.line }, line: { width: 0 },
  });

  text(s, "“I know what to do.\nI just don't do it.”", {
    x: 1.05, y: 4.5, w: 3.4, h: 0.9, fontSize: 17, italic: true,
    color: C.ink, lineSpacing: 25,
  });
  text(s, "He has had four plans. None survived week two.", {
    x: 1.05, y: 5.55, w: 3.4, h: 0.5, fontSize: 11.5, color: C.muted, lineSpacing: 16,
  });

  // The three breaks
  const breaks = [
    { c: C.meal, t: "The plan ignores him",
      b: "Schedule, cuisine, allergies, a bad knee — none of it reaches a generic plan." },
    { c: C.water, t: "Nothing is recorded",
      b: "No log of what was eaten, drunk or skipped. No honest signal to act on." },
    { c: C.exercise, t: "Nothing adapts",
      b: "The 6 a.m. workout he has skipped four times is on the plan again tomorrow." },
  ];
  breaks.forEach((b, i) => {
    const y = 1.78 + i * 1.16;
    card(s, 5.1, y, 7.5, 1.0);
    s.addShape(pptx.ShapeType.roundRect, {
      x: 5.36, y: y + 0.3, w: 0.05, h: 0.4, rectRadius: 0.5,
      fill: { color: b.c }, line: { width: 0 },
    });
    text(s, b.t, { x: 5.62, y: y + 0.2, w: 6.6, h: 0.3, fontSize: 14, bold: true, color: C.ink });
    text(s, b.b, { x: 5.62, y: y + 0.55, w: 6.7, h: 0.35, fontSize: 11.5, color: C.muted });
  });

  card(s, 5.1, 5.26, 7.5, 1.02, { fill: C.brandDeep, border: C.brandDeep });
  text(s, "Adherence is the product. The plan is just the input.", {
    x: 5.45, y: 5.62, w: 7, h: 0.4, fontSize: 16, bold: true, color: C.white,
  });
}

/* ══════════════════════════════════════════════════ 02 · AI approach */
{
  const s = slide(2, "AI approach", "The model reads the record, not just the profile");

  // Evidence in → plan out
  const cols = [
    { t: "What goes in", c: C.muted, items: [
      "Profile — diet, allergies, limits, free minutes",
      "Item-by-item check-in record, last 3 days",
      "Skip notes in the user's own words",
      "Energy · difficulty · hunger ratings",
    ]},
    { t: "What must come out", c: C.brand, items: [
      "A why on every single item",
      "A rationale for the whole day",
      "An adjustmentNote naming the change AND its evidence",
      "Never re-issue a missed item unchanged",
    ]},
  ];
  cols.forEach((col, i) => {
    const x = 0.72 + i * 4.2;
    card(s, x, 1.78, 3.9, 2.85);
    text(s, col.t, {
      x: x + 0.3, y: 2.0, w: 3.3, h: 0.3, fontSize: 13, bold: true, color: col.c,
    });
    col.items.forEach((it, j) => {
      const y = 2.42 + j * 0.52;
      s.addShape(pptx.ShapeType.ellipse, {
        x: x + 0.32, y: y + 0.09, w: 0.09, h: 0.09,
        fill: { color: col.c }, line: { width: 0 },
      });
      text(s, it, { x: x + 0.55, y, w: 3.05, h: 0.46, fontSize: 10.8, color: C.muted, lineSpacing: 14 });
    });
  });

  s.addShape(pptx.ShapeType.rightArrow, {
    x: 4.72, y: 3.06, w: 0.36, h: 0.2, fill: { color: C.brand }, line: { width: 0 },
  });

  // The guarantee column
  card(s, 9.12, 1.78, 3.5, 2.85, { fill: C.brandSoft, border: "C8DED2" });
  text(s, "Never a blank day", {
    x: 9.42, y: 2.0, w: 2.9, h: 0.3, fontSize: 13, bold: true, color: C.brandDeep,
  });
  const guards = [
    "Zod-validated JSON, corrective retry",
    "Deterministic allergen gate over every meal",
    "Rule-based planner takes over on any failure",
    "Adherence is computed, never generated",
  ];
  guards.forEach((g, j) => {
    const y = 2.42 + j * 0.52;
    text(s, "—", { x: 9.42, y, w: 0.2, h: 0.2, fontSize: 10, bold: true, color: C.brand });
    text(s, g, { x: 9.65, y, w: 2.7, h: 0.46, fontSize: 10.8, color: "2F6B4C", lineSpacing: 14 });
  });

  // The real output
  card(s, 0.72, 4.86, 11.9, 1.42, { fill: C.ink, border: C.ink });
  text(s, "REAL OUTPUT  ·  plan.adjustmentNote", {
    x: 1.05, y: 5.05, w: 6, h: 0.24, fontSize: 9.5, bold: true, color: "7FC2A0", charSpacing: 1.2,
  });
  text(s,
    "“Moved your workout from 08:00 to 19:00 — you skipped it on both mornings but noted evenings after 7 would work better.”",
    { x: 1.05, y: 5.38, w: 11.2, h: 0.72, fontSize: 15.5, italic: true, color: C.white, lineSpacing: 23 },
  );
}

/* ════════════════════════════════════════════════════ 03 · live demo */
{
  const s = slide(3, "Live demo", "Three clicks, three proof points");

  const steps = [
    { n: "1", t: "Profile → plan", c: C.brand,
      b: "Register with a mobile, fill the profile, generate.",
      out: "A full day of meals, hydration and movement — every item with a Why this? line." },
    { n: "2", t: "Miss → adapt", c: C.meal,
      b: "Skip the workout, leave a note, generate tomorrow.",
      out: "The green What changed block names the miss and moves the item." },
    { n: "3", t: "Due → phone rings", c: C.water,
      b: "Reminder calls on, then Call now.",
      out: "Two seconds of silence, then the Gujarati reminder, then it hangs up." },
  ];

  steps.forEach((st, i) => {
    const x = 0.72 + i * 4.02;
    card(s, x, 1.78, 3.75, 2.9);
    s.addShape(pptx.ShapeType.ellipse, {
      x: x + 0.3, y: 2.05, w: 0.5, h: 0.5, fill: { color: st.c }, line: { width: 0 },
    });
    text(s, st.n, {
      x: x + 0.3, y: 2.16, w: 0.5, h: 0.3, fontSize: 15, bold: true, color: C.white, align: "center",
    });
    text(s, st.t, { x: x + 0.3, y: 2.72, w: 3.1, h: 0.32, fontSize: 15.5, bold: true, color: C.ink });
    text(s, st.b, { x: x + 0.3, y: 3.12, w: 3.15, h: 0.5, fontSize: 11, color: C.muted, lineSpacing: 15 });
    s.addShape(pptx.ShapeType.rect, {
      x: x + 0.3, y: 3.72, w: 3.1, h: 0.02, fill: { color: C.line }, line: { width: 0 },
    });
    text(s, st.out, { x: x + 0.3, y: 3.86, w: 3.15, h: 0.7, fontSize: 11, color: st.c, lineSpacing: 15 });
  });

  // The rule that keeps it honest
  card(s, 0.72, 4.94, 11.9, 1.34, { fill: C.surface });
  s.addShape(pptx.ShapeType.roundRect, {
    x: 1.0, y: 5.2, w: 0.05, h: 0.8, rectRadius: 0.5, fill: { color: C.warn }, line: { width: 0 },
  });
  text(s, "And the plan will not simply hand itself over", {
    x: 1.26, y: 5.16, w: 6.5, h: 0.3, fontSize: 13.5, bold: true, color: C.ink,
  });
  text(s,
    "A new day is only generated once the previous day reaches 70% completion. Below that the day is locked, the shortfall is shown, and the score is live — finish the day and it unlocks itself.",
    { x: 1.26, y: 5.52, w: 11.1, h: 0.62, fontSize: 11.5, color: C.muted, lineSpacing: 16 },
  );
}

/* ═══════════════════════════════════════════════════ 04 · architecture */
{
  const s = slide(4, "Architecture", "One process, one file, three services");

  const layers = [
    { t: "CLIENT", c: C.brand, items: ["Next.js 16 · React 19", "Server components", "Tailwind v4"] },
    { t: "SERVER", c: C.water, items: ["Route handlers", "scrypt auth + sessions", "/telephony webhooks"] },
    { t: "DOMAIN", c: C.meal, items: ["adherence.ts", "planGate.ts", "reminder scheduler"] },
    { t: "DATA", c: C.exercise, items: ["Prisma 7 · SQLite", "9 models", "dev.db on disk"] },
  ];

  layers.forEach((L, i) => {
    const y = 1.78 + i * 0.94;
    text(s, L.t, {
      x: 0.72, y: y + 0.26, w: 1.3, h: 0.26, fontSize: 10, bold: true, color: L.c, charSpacing: 1.2,
    });
    L.items.forEach((it, j) => {
      const x = 2.1 + j * 2.6;
      card(s, x, y, 2.42, 0.76);
      s.addShape(pptx.ShapeType.roundRect, {
        x: x + 0.18, y: y + 0.22, w: 0.045, h: 0.32, rectRadius: 0.5,
        fill: { color: L.c }, line: { width: 0 },
      });
      text(s, it, { x: x + 0.36, y: y + 0.26, w: 2.0, h: 0.3, fontSize: 10.5, color: C.ink });
    });
  });

  // External services, called out as the only moving parts
  const ext = [
    ["OpenAI  gpt-4o-mini", "plan · summary · coach · Gujarati line", C.brand],
    ["Sarvam  bulbul:v3", "Gujarati speech at 8 kHz, telephony-native", C.water],
    ["Vobiz  Voice API", "outbound call · XML · ngrok in dev", C.exercise],
  ];
  text(s, "EXTERNAL", {
    x: 0.72, y: 5.68, w: 1.3, h: 0.26, fontSize: 10, bold: true, color: C.muted, charSpacing: 1.2,
  });
  ext.forEach(([t, b, col], i) => {
    const x = 2.1 + i * 3.53;
    card(s, x, 5.5, 3.35, 0.82, { fill: C.surface });
    s.addShape(pptx.ShapeType.roundRect, {
      x: x + 0.2, y: 5.72, w: 0.045, h: 0.38, rectRadius: 0.5,
      fill: { color: col }, line: { width: 0 },
    });
    text(s, t, { x: x + 0.38, y: 5.68, w: 2.9, h: 0.26, fontSize: 11, bold: true, color: C.ink });
    text(s, b, { x: x + 0.38, y: 5.92, w: 2.9, h: 0.28, fontSize: 9.2, color: C.muted });
  });

  text(s, "Every one of the three has a fallback. None of them can produce a blank day.", {
    x: 2.1, y: 6.5, w: 10.5, h: 0.28, fontSize: 10.5, italic: true, color: C.muted,
  });
}

/* ═════════════════════════════════════════════════ 05 · impact & limits */
{
  const s = slide(5, "Impact & limits", "What it changes — and what it deliberately will not do");

  // Impact
  const impact = [
    ["Reaches people an app cannot", "A Gujarati voice call lands with users who will never open an English wellness app twice a day."],
    ["Turns a miss into information", "A skipped item is evidence that rewrites tomorrow, not a red mark on a streak."],
    ["Explains every number", "Adherence is computed from check-in rows, so the score on screen is the score the AI reasons over."],
  ];
  text(s, "IMPACT", {
    x: 0.72, y: 1.78, w: 3, h: 0.26, fontSize: 10, bold: true, color: C.brand, charSpacing: 1.2,
  });
  impact.forEach(([t, b], i) => {
    const y = 2.12 + i * 1.14;
    card(s, 0.72, y, 5.9, 1.0);
    text(s, t, { x: 1.02, y: y + 0.16, w: 5.3, h: 0.28, fontSize: 13, bold: true, color: C.ink });
    text(s, b, { x: 1.02, y: y + 0.46, w: 5.4, h: 0.44, fontSize: 10.8, color: C.muted, lineSpacing: 14.5 });
  });

  // Limits — stated plainly, because a finalist deck that claims no limits reads as untested
  const limits = [
    ["Not medical", "No diagnosis, no medication, no symptom reading. Red-flag input is blocked before it reaches the model."],
    ["Single device today", "SQLite on disk, one process. Fine for a demo, not yet for scale."],
    ["Calls need a tunnel", "Vobiz must reach a public https URL; on a laptop that is ngrok."],
  ];
  text(s, "LIMITS", {
    x: 6.94, y: 1.78, w: 3, h: 0.26, fontSize: 10, bold: true, color: C.warn, charSpacing: 1.2,
  });
  limits.forEach(([t, b], i) => {
    const y = 2.12 + i * 1.14;
    card(s, 6.94, y, 5.68, 1.0);
    text(s, t, { x: 7.24, y: y + 0.16, w: 5.1, h: 0.28, fontSize: 13, bold: true, color: C.ink });
    text(s, b, { x: 7.24, y: y + 0.46, w: 5.2, h: 0.44, fontSize: 10.8, color: C.muted, lineSpacing: 14.5 });
  });

  card(s, 0.72, 5.62, 11.9, 0.78, { fill: C.brandDeep, border: C.brandDeep });
  text(s, "General wellness only — it never claims to replace a qualified professional.", {
    x: 1.05, y: 5.86, w: 7.6, h: 0.32, fontSize: 12.5, bold: true, color: C.white,
  });
  text(s, "github.com/Dhruvil1308/Personal-Wellness-Planning-Adherence-Coach---Track-2", {
    x: 8.4, y: 5.88, w: 4.0, h: 0.3, fontSize: 9, color: "8FC7AB", align: "right",
  });
}

await pptx.writeFile({ fileName: OUT });
console.log(`✓ ${OUT}`);
