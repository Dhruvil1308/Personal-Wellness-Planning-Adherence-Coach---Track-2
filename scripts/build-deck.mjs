/**
 * Builds the 10-slide pitch deck as a real .pptx.
 *
 *   node scripts/build-deck.mjs
 *
 * Palette and type are lifted from the product so the deck reads as the same
 * thing the judges are about to open. Every quoted AI output in here is real —
 * pulled from dev.db, not written for the slide.
 */
import PptxGenJS from "pptxgenjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "WellPath-AI-Track2.pptx",
);

const C = {
  ink: "17211C",
  body: "3A4741",
  muted: "64726A",
  line: "E2E6DF",
  bg: "F6F7F4",
  surface: "FFFFFF",
  brand: "1F6F4A",
  brandDeep: "0F3D28",
  brandSoft: "E8F2EC",
  meal: "C2703B",
  mealSoft: "FBEEE4",
  water: "2B7FA8",
  waterSoft: "E5F1F7",
  exercise: "9C3F6D",
  exerciseSoft: "F8E9F1",
  warn: "9A6A17",
  warnSoft: "FBF1DE",
  danger: "B4452F",
  dangerSoft: "FBEAE6",
  white: "FFFFFF",
};

const F = "Segoe UI";
const W = 13.333;
const H = 7.5;

const pptx = new PptxGenJS();
pptx.defineLayout({ name: "WIDE", width: W, height: H });
pptx.layout = "WIDE";
pptx.author = "WellPath AI";
pptx.company = "Hack The Stack — August 2026";
pptx.title = "WellPath AI — Personal Wellness Planning & Adherence Coach";

/* ------------------------------------------------------------------ helpers */

const card = (s, x, y, w, h, opts = {}) =>
  s.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    rectRadius: opts.radius ?? 0.09,
    fill: { color: opts.fill ?? C.surface },
    line: { color: opts.border ?? C.line, width: opts.borderWidth ?? 1 },
    shadow: opts.shadow
      ? { type: "outer", angle: 90, blur: 10, offset: 1.5, opacity: 0.07, color: "000000" }
      : { type: "outer", blur: 0, offset: 0, opacity: 0 },
  });

const text = (s, str, o) =>
  s.addText(str, { fontFace: F, color: C.body, valign: "top", ...o });

/** Every content slide shares this frame: eyebrow, title, rule, page number. */
function slide(eyebrow, title, n, sub) {
  const s = pptx.addSlide();
  s.background = { color: C.bg };

  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.09, fill: { color: C.brand } });

  text(s, eyebrow.toUpperCase(), {
    x: 0.62, y: 0.34, w: 8, h: 0.26,
    fontSize: 11, bold: true, color: C.brand, charSpacing: 1.4,
  });
  text(s, title, {
    x: 0.6, y: 0.62, w: 11.2, h: 0.62,
    fontSize: 30, bold: true, color: C.ink,
  });
  if (sub) {
    text(s, sub, { x: 0.62, y: 1.24, w: 11.4, h: 0.36, fontSize: 13.5, color: C.muted });
  }

  text(s, `${n}`, {
    x: W - 0.85, y: H - 0.55, w: 0.4, h: 0.3,
    fontSize: 11, color: C.muted, align: "right",
  });
  text(s, "WellPath AI", {
    x: 0.62, y: H - 0.55, w: 3, h: 0.3, fontSize: 10, color: C.muted,
  });
  return s;
}

/** Small pill used for tags and status chips. */
function pill(s, str, x, y, w, fill, color, h = 0.3) {
  s.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.15, fill: { color: fill }, line: { color: fill, width: 0 },
  });
  text(s, str, {
    x, y: y + 0.045, w, h: h - 0.09,
    fontSize: 10.5, bold: true, color, align: "center",
  });
}

/** Left-edge accent bar — the visual motif that ties the cards together. */
function accent(s, x, y, h, color) {
  s.addShape(pptx.ShapeType.roundRect, {
    x, y, w: 0.055, h, rectRadius: 0.5, fill: { color }, line: { width: 0 },
  });
}

function arrow(s, x, y, w = 0.42, color = C.brand) {
  s.addShape(pptx.ShapeType.rightArrow, {
    x, y, w, h: 0.22, fill: { color }, line: { width: 0 },
  });
}

/* ------------------------------------------------------------- 1 · title */
{
  const s = pptx.addSlide();
  s.background = { color: C.brandDeep };

  // Layered arcs suggesting a rising path — the product's logo motif.
  s.addShape(pptx.ShapeType.ellipse, {
    x: 8.6, y: -2.2, w: 7.6, h: 7.6,
    fill: { color: C.brand }, line: { width: 0 },
  });
  s.addShape(pptx.ShapeType.ellipse, {
    x: 10.1, y: 2.9, w: 5.6, h: 5.6,
    fill: { color: "17573A" }, line: { width: 0 },
  });
  s.addShape(pptx.ShapeType.ellipse, {
    x: 8.42, y: 1.28, w: 0.34, h: 0.34,
    fill: { color: C.brandSoft }, line: { width: 0 },
  });

  text(s, "HACK THE STACK  ·  AUGUST 2026  ·  TRACK 2", {
    x: 0.85, y: 1.15, w: 9, h: 0.3,
    fontSize: 12, bold: true, color: "9FD3B8", charSpacing: 1.8,
  });

  text(s, "WellPath AI", {
    x: 0.8, y: 1.62, w: 9.2, h: 1.15, fontSize: 60, bold: true, color: C.white,
  });
  text(s, "Personal Wellness Planning & Adherence Coach", {
    x: 0.82, y: 2.72, w: 9.2, h: 0.5, fontSize: 21, color: "C7E4D4",
  });

  s.addShape(pptx.ShapeType.rect, {
    x: 0.85, y: 3.45, w: 1.5, h: 0.045, fill: { color: "5FAE86" }, line: { width: 0 },
  });

  text(s,
    "A plan that rewrites itself from what you actually did —\nthen phones you in Gujarati to make sure you do it.",
    { x: 0.82, y: 3.75, w: 8.4, h: 1.0, fontSize: 17, color: C.white, lineSpacing: 26 },
  );

  const tags = [
    "Health & Wellness",
    "Social Impact",
    "Next.js · Prisma · SQLite",
    "GPT-4o-mini · Sarvam · Vobiz",
  ];
  let tx = 0.85;
  tags.forEach((t) => {
    const w = 0.28 + t.length * 0.098;
    s.addShape(pptx.ShapeType.roundRect, {
      x: tx, y: 5.15, w, h: 0.42, rectRadius: 0.21,
      fill: { color: "17573A" }, line: { color: "3E8C63", width: 1 },
    });
    text(s, t, { x: tx, y: 5.235, w, h: 0.26, fontSize: 11, color: "C7E4D4", align: "center" });
    tx += w + 0.16;
  });

  text(s, "GENERAL WELLNESS ONLY — no diagnosis, no medication, no substitute for a professional.", {
    x: 0.85, y: 6.35, w: 10.5, h: 0.3, fontSize: 11.5, bold: true, color: "7FC2A0",
  });
  text(s, "github.com/Dhruvil1308/Personal-Wellness-Planning-Adherence-Coach---Track-2", {
    x: 0.85, y: 6.68, w: 10.5, h: 0.3, fontSize: 10.5, color: "6BA588",
  });
}

/* ------------------------------------------------------------ 2 · problem */
{
  const s = slide("The problem", "Good plans die at execution", 2,
    "Generic diet and activity plans ignore the day the person is actually living.");

  const items = [
    { c: C.meal, cs: C.mealSoft, t: "The plan ignores the person",
      b: "Age, schedule, cuisine, allergies, a bad knee, 25 free minutes — none of it reaches a generic plan. So it never fits, and it gets abandoned in week one." },
    { c: C.water, cs: C.waterSoft, t: "Execution is invisible",
      b: "Nobody records what was actually eaten, drunk or skipped. Without that record there is no honest signal — only a plan and a vague sense of failure." },
    { c: C.exercise, cs: C.exerciseSoft, t: "Nothing ever adapts",
      b: "The 6 a.m. workout you have skipped four times is on the plan again tomorrow. The plan does not learn, so the same item keeps failing." },
  ];

  items.forEach((it, i) => {
    const x = 0.62 + i * 4.06;
    card(s, x, 1.85, 3.78, 2.75, { shadow: true });
    accent(s, x + 0.28, 2.12, 0.44, it.c);
    text(s, `0${i + 1}`, {
      x: x + 0.5, y: 2.1, w: 1, h: 0.34, fontSize: 15, bold: true, color: it.c,
    });
    text(s, it.t, {
      x: x + 0.28, y: 2.68, w: 3.25, h: 0.62, fontSize: 16.5, bold: true, color: C.ink,
    });
    text(s, it.b, {
      x: x + 0.28, y: 3.32, w: 3.25, h: 1.2, fontSize: 11.8, color: C.muted, lineSpacing: 17,
    });
  });

  card(s, 0.62, 4.92, 12.1, 1.55, { fill: C.brandSoft, border: C.brandSoft });
  text(s, "So the real problem is not the plan. It is the loop around it.", {
    x: 1.0, y: 5.15, w: 11.4, h: 0.4, fontSize: 17, bold: true, color: C.brandDeep,
  });
  text(s,
    "A plan is a one-off guess. What changes behaviour is the cycle: personalise it → record what actually happened → " +
    "explain the gap → rewrite tomorrow from the evidence → and be there at the moment the task is due.",
    { x: 1.0, y: 5.6, w: 11.3, h: 0.75, fontSize: 12.5, color: C.brandDeep, lineSpacing: 18 },
  );
}

/* ----------------------------------------------------------- 3 · solution */
{
  const s = slide("The solution", "A closed loop, not a one-off plan", 3,
    "WellPath runs the whole cycle — and every step is visible to the user.");

  const steps = [
    { n: "01", t: "Profile", c: C.brand,
      b: "Age, weight, goal, diet, cuisine, allergies, limitations, wake / sleep, free minutes — and the mobile number." },
    { n: "02", t: "Explainable plan", c: C.meal,
      b: "Meals, hydration and movement scheduled around the real day. Every item carries a Why this? line." },
    { n: "03", t: "Check-ins", c: C.water,
      b: "Done · partly · skipped. Water logs by the glass. A skip can carry a note — that note is evidence." },
    { n: "04", t: "Adjust & call", c: C.exercise,
      b: "Tomorrow is rewritten from the record. At each due time the phone rings in Gujarati." },
  ];

  steps.forEach((st, i) => {
    const x = 0.62 + i * 3.15;
    card(s, x, 1.95, 2.78, 2.62, { shadow: true });
    s.addShape(pptx.ShapeType.roundRect, {
      x: x + 0.26, y: 2.2, w: 0.62, h: 0.62, rectRadius: 0.14,
      fill: { color: st.c }, line: { width: 0 },
    });
    text(s, st.n, {
      x: x + 0.26, y: 2.36, w: 0.62, h: 0.3, fontSize: 14, bold: true,
      color: C.white, align: "center",
    });
    text(s, st.t, {
      x: x + 0.26, y: 3.0, w: 2.3, h: 0.36, fontSize: 16, bold: true, color: C.ink,
    });
    text(s, st.b, {
      x: x + 0.26, y: 3.42, w: 2.3, h: 1.05, fontSize: 11.3, color: C.muted, lineSpacing: 16,
    });
    if (i < 3) arrow(s, x + 2.86, 3.15, 0.24, C.line);
  });

  // The loop-closing return path.
  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.62, y: 4.78, w: 12.1, h: 0.5, rectRadius: 0.12,
    fill: { color: C.brandSoft }, line: { width: 0 },
  });
  text(s, "◄   tomorrow's plan is built from steps 02 + 03 — the loop closes here", {
    x: 0.62, y: 4.9, w: 12.1, h: 0.3, fontSize: 12, bold: true,
    color: C.brandDeep, align: "center",
  });

  const stats = [
    ["4", "AI jobs, none decorative"],
    ["3", "streams tracked: meals · water · movement"],
    ["0", "empty days — rule-based planner backs up every call"],
    ["2 s", "pause after pickup, then the Gujarati reminder"],
  ];
  stats.forEach(([big, lbl], i) => {
    const x = 0.62 + i * 3.06;
    card(s, x, 5.45, 2.9, 1.15);
    text(s, big, { x: x + 0.22, y: 5.58, w: 2.5, h: 0.45, fontSize: 24, bold: true, color: C.brand });
    text(s, lbl, { x: x + 0.22, y: 6.04, w: 2.5, h: 0.5, fontSize: 10.5, color: C.muted, lineSpacing: 14 });
  });
}

/* -------------------------------------------------------- 4 · MVP coverage */
{
  const s = slide("Scope", "Every mandatory requirement, built and testable", 4,
    "The brief's MVP list and the AI-must-perform list, mapped to what a judge can click.");

  const left = [
    ["Profile: age, height, weight, goal, preferences", "/register → /onboarding — 15 fields, incl. allergies and limitations"],
    ["AI meal, hydration and activity plan", "GPT-4o-mini, Zod-validated JSON, 4–8 scheduled items per day"],
    ["Meal, water and exercise check-ins", "Done / partly / skipped; water accumulates by the glass"],
    ["Adherence and completion tracking", "Deterministic weighted score — meals 45 · water 20 · movement 35"],
    ["End-of-day summary from recorded data", "Prompt-constrained to logged rows only; never assumes an unlogged item"],
    ["Next-plan adjustment from completion + feedback", "Last 3 days of adherence and notes go into the planning prompt"],
  ];
  const right = [
    ["Create a personalised, explainable plan", "Per-item Why this? plus a whole-day rationale"],
    ["Analyse adherence and user feedback", "Item-by-item record rendered into the prompt as evidence"],
    ["Adjust future recommendations contextually", "adjustmentNote must name the change and the evidence"],
    ["Provide safe and supportive motivation", "Coach reads the day's real numbers; never shames a miss"],
  ];
  const extras = [
    ["Scheduled reminders", "Outbound Gujarati voice calls"],
    ["Progress visualisation", "Adherence dashboard + trends"],
    ["Regional meal options", "6 cuisines, 5 diets, Jain-aware"],
  ];

  text(s, "MANDATORY MVP", {
    x: 0.65, y: 1.72, w: 5, h: 0.26, fontSize: 10.5, bold: true, color: C.brand, charSpacing: 1.2,
  });
  left.forEach(([t, d], i) => {
    const y = 2.04 + i * 0.76;
    card(s, 0.62, y, 6.15, 0.68);
    s.addShape(pptx.ShapeType.ellipse, {
      x: 0.83, y: y + 0.19, w: 0.29, h: 0.29, fill: { color: C.brandSoft }, line: { width: 0 },
    });
    text(s, "✓", { x: 0.83, y: y + 0.225, w: 0.29, h: 0.22, fontSize: 12, bold: true, color: C.brand, align: "center" });
    text(s, t, { x: 1.25, y: y + 0.09, w: 5.4, h: 0.26, fontSize: 12, bold: true, color: C.ink });
    text(s, d, { x: 1.25, y: y + 0.35, w: 5.4, h: 0.26, fontSize: 10, color: C.muted });
  });

  text(s, "AI MUST PERFORM", {
    x: 7.15, y: 1.72, w: 5, h: 0.26, fontSize: 10.5, bold: true, color: C.meal, charSpacing: 1.2,
  });
  right.forEach(([t, d], i) => {
    const y = 2.04 + i * 0.76;
    card(s, 7.12, y, 5.6, 0.68);
    s.addShape(pptx.ShapeType.ellipse, {
      x: 7.33, y: y + 0.19, w: 0.29, h: 0.29, fill: { color: C.mealSoft }, line: { width: 0 },
    });
    text(s, "✓", { x: 7.33, y: y + 0.225, w: 0.29, h: 0.22, fontSize: 12, bold: true, color: C.meal, align: "center" });
    text(s, t, { x: 7.75, y: y + 0.09, w: 4.85, h: 0.26, fontSize: 12, bold: true, color: C.ink });
    text(s, d, { x: 7.75, y: y + 0.35, w: 4.85, h: 0.26, fontSize: 10, color: C.muted });
  });

  text(s, "OPTIONAL UPGRADES SHIPPED", {
    x: 7.15, y: 5.14, w: 5, h: 0.26, fontSize: 10.5, bold: true, color: C.exercise, charSpacing: 1.2,
  });
  extras.forEach(([t, d], i) => {
    const y = 5.46 + i * 0.42;
    text(s, "+", { x: 7.15, y, w: 0.25, h: 0.28, fontSize: 13, bold: true, color: C.exercise });
    text(s, t, { x: 7.45, y: y + 0.02, w: 2.1, h: 0.26, fontSize: 11, bold: true, color: C.ink });
    text(s, d, { x: 9.5, y: y + 0.02, w: 3.2, h: 0.26, fontSize: 10.5, color: C.muted });
  });
}

/* -------------------------------------------------------------- 5 · the AI */
{
  const s = slide("AI is core, not decorative", "Four jobs the model actually does", 5,
    "Remove the model and the product stops working — there is no template underneath.");

  const jobs = [
    { c: C.brand, cs: C.brandSoft, t: "Plan", f: "ai/planner.ts",
      b: "Writes the day from the profile plus 3 days of recorded adherence. The prompt forbids re-issuing an item that was missed — it must be moved, shrunk or swapped." },
    { c: C.water, cs: C.waterSoft, t: "Analyse", f: "ai/summarizer.ts",
      b: "End-of-day recap constrained to logged rows. An unlogged item is reported as not logged — never assumed done, never assumed skipped." },
    { c: C.meal, cs: C.mealSoft, t: "Adjust", f: "adjustmentNote",
      b: "Names the specific change and the evidence behind it. This field is what makes the loop legible to the user and to a judge." },
    { c: C.exercise, cs: C.exerciseSoft, t: "Motivate", f: "ai/coach.ts + voice/script.ts",
      b: "Chat coaching grounded in the real numbers, and the Gujarati reminder line written fresh at dial time from live progress." },
  ];

  jobs.forEach((j, i) => {
    const x = 0.62 + (i % 2) * 6.22;
    const y = 1.85 + Math.floor(i / 2) * 1.83;
    card(s, x, y, 5.94, 1.66, { shadow: true });
    accent(s, x + 0.26, y + 0.26, 1.14, j.c);
    text(s, j.t, { x: x + 0.5, y: y + 0.2, w: 3, h: 0.36, fontSize: 17, bold: true, color: C.ink });
    text(s, j.f, { x: x + 0.5, y: y + 0.56, w: 3.4, h: 0.24, fontSize: 9.5, color: j.c, bold: true });
    text(s, j.b, { x: x + 0.5, y: y + 0.85, w: 5.2, h: 0.72, fontSize: 11, color: C.muted, lineSpacing: 15.5 });
  });

  card(s, 0.62, 5.56, 5.94, 1.28, { fill: C.ink, border: C.ink });
  text(s, "Explainability is a field, not a promise", {
    x: 0.92, y: 5.72, w: 5.4, h: 0.3, fontSize: 13, bold: true, color: C.white,
  });
  text(s, "Every item ships a why. Every plan ships a rationale. Every change ships an adjustmentNote. The UI renders all three.", {
    x: 0.92, y: 6.06, w: 5.4, h: 0.68, fontSize: 10.8, color: "B9C6BF", lineSpacing: 15,
  });

  card(s, 6.84, 5.56, 5.88, 1.28, { fill: C.warnSoft, border: C.warnSoft });
  text(s, "Adherence itself is NOT the model", {
    x: 7.14, y: 5.72, w: 5.4, h: 0.3, fontSize: 13, bold: true, color: C.warn,
  });
  text(s, "Scores are computed in adherence.ts from check-in rows, then fed to the model. The number on screen and the number the AI reasons over are the same number.", {
    x: 7.14, y: 6.04, w: 5.35, h: 0.72, fontSize: 10.2, color: "7A5412", lineSpacing: 14,
  });
}

/* --------------------------------------------------- 6 · adjustment engine */
{
  const s = slide("Core AI demo", "Missed tasks change the next recommendation", 6,
    "The proof point judges ask for — shown with output taken straight from the running app.");

  // Evidence column
  card(s, 0.62, 1.8, 4.5, 3.05, { shadow: true });
  pill(s, "DAY 1 + 2  ·  RECORDED", 0.88, 2.02, 2.5, C.dangerSoft, C.danger, 0.28);
  text(s, "What the record showed", {
    x: 0.88, y: 2.42, w: 4, h: 0.32, fontSize: 14.5, bold: true, color: C.ink,
  });
  const evidence = [
    ["Workout 08:00", "SKIPPED  ×2"],
    ["Breakfast 07:00", "never logged  ×2"],
    ["Hydration", "1000 / 2700 ml"],
    ["Feedback note", "\"8am collides with work\""],
  ];
  evidence.forEach(([k, v], i) => {
    const y = 2.85 + i * 0.44;
    text(s, k, { x: 0.88, y, w: 1.75, h: 0.28, fontSize: 10.5, color: C.muted });
    text(s, v, { x: 2.6, y, w: 2.45, h: 0.3, fontSize: 10.5, bold: true, color: C.danger });
  });
  text(s, "Overall adherence  42.9%", {
    x: 0.88, y: 4.44, w: 4, h: 0.3, fontSize: 12, bold: true, color: C.ink,
  });

  arrow(s, 5.32, 3.18, 0.5, C.brand);
  text(s, "AI reads\nthe record", {
    x: 5.02, y: 3.5, w: 1.1, h: 0.55, fontSize: 9.5, color: C.muted, align: "center", lineSpacing: 12,
  });

  // Result column
  card(s, 6.3, 1.8, 6.42, 3.05, { fill: C.brandSoft, border: "BFDCCB", shadow: true });
  pill(s, "NEXT DAY  ·  GENERATED", 6.56, 2.02, 2.6, C.brand, C.white, 0.28);
  text(s, "What the next plan said", {
    x: 6.56, y: 2.42, w: 5.5, h: 0.32, fontSize: 14.5, bold: true, color: C.brandDeep,
  });
  text(s,
    "“Moved your workout from 08:00 to 19:00 — you skipped it on both mornings but noted evenings after 7 would work better.”",
    { x: 6.56, y: 2.85, w: 5.9, h: 0.95, fontSize: 13.5, italic: true, color: C.brandDeep, lineSpacing: 20 },
  );
  text(s, "Breakfast also moved 07:00 → 09:00 and the session was cut to 15 minutes.", {
    x: 6.56, y: 3.85, w: 5.9, h: 0.3, fontSize: 11, color: "2F6B4C",
  });
  text(s, "Verbatim from plan.adjustmentNote — no template, no hand-editing.", {
    x: 6.56, y: 4.3, w: 5.9, h: 0.3, fontSize: 10, color: "4F7F66", italic: true,
  });

  // Second real sample
  card(s, 0.62, 5.05, 12.1, 1.05, { fill: C.surface });
  accent(s, 0.88, 5.25, 0.65, C.meal);
  text(s, "Another real run — preferences, not just misses", {
    x: 1.1, y: 5.2, w: 6, h: 0.28, fontSize: 11.5, bold: true, color: C.ink,
  });
  text(s,
    "“Replaced 'Palak Paneer with Roti' with 'Vegetable Pulao' for dinner since you mentioned not liking it, and adjusted the timing of the gentle walk to earlier in the day based on your activity history.”",
    { x: 1.1, y: 5.5, w: 11.3, h: 0.5, fontSize: 11, italic: true, color: C.muted, lineSpacing: 15 },
  );

  text(s, "Missed → moved.   Disliked → swapped.   Too long → shortened.   The plan never simply repeats itself.", {
    x: 0.62, y: 6.28, w: 12.1, h: 0.32, fontSize: 12, bold: true, color: C.brand, align: "center",
  });
}

/* ------------------------------------------------------------ 7 · dashboard */
{
  const s = slide("Explainability", "The dashboard explains adherence", 7,
    "Every number traces back to a check-in row a judge can create in ten seconds.");

  card(s, 0.62, 1.82, 5.05, 2.62, { shadow: true });
  text(s, "How the score is built", {
    x: 0.88, y: 2.02, w: 4.6, h: 0.32, fontSize: 15, bold: true, color: C.ink,
  });
  const streams = [
    ["Meals", 45, C.meal],
    ["Hydration", 20, C.water],
    ["Movement", 35, C.exercise],
  ];
  streams.forEach(([label, weight, col], i) => {
    const y = 2.5 + i * 0.55;
    text(s, label, { x: 0.88, y, w: 1.6, h: 0.26, fontSize: 12, bold: true, color: C.ink });
    text(s, `${weight}% of score`, { x: 3.9, y, w: 1.5, h: 0.26, fontSize: 10, color: C.muted, align: "right" });
    s.addShape(pptx.ShapeType.roundRect, {
      x: 0.88, y: y + 0.28, w: 4.5, h: 0.13, rectRadius: 0.065,
      fill: { color: C.line }, line: { width: 0 },
    });
    s.addShape(pptx.ShapeType.roundRect, {
      x: 0.88, y: y + 0.28, w: 4.5 * (weight / 100), h: 0.13, rectRadius: 0.065,
      fill: { color: col }, line: { width: 0 },
    });
  });
  text(s, "Done = 1 · Partly = 0.5 · Skipped or never logged = 0.\nA logged quantity beats the bucket: 25 of a 30-min walk scores 0.83.", {
    x: 0.88, y: 4.06, w: 4.6, h: 0.52, fontSize: 9.5, color: C.muted, lineSpacing: 13,
  });

  s.addChart(
    pptx.ChartType.bar,
    [{ name: "Adherence", labels: ["Thu", "Fri", "Sat", "Sun", "Mon"], values: [41, 43, 22, 68, 86] }],
    {
      x: 5.95, y: 1.82, w: 6.8, h: 2.62,
      barDir: "col", chartColors: [C.danger, C.danger, C.danger, C.warn, C.brand],
      showLegend: false, showValue: true,
      dataLabelFontSize: 9, dataLabelColor: C.muted, dataLabelPosition: "outEnd",
      catAxisLabelFontSize: 10, catAxisLabelColor: C.muted,
      valAxisLabelFontSize: 9, valAxisLabelColor: C.muted,
      valAxisMaxVal: 100, valAxisMajorUnit: 25,
      catAxisLineShow: false, valAxisLineShow: false,
      barGapWidthPct: 120, plotArea: { fill: { color: C.surface } },
      title: "Daily adherence — one bar per planned day",
      showTitle: true, titleFontSize: 12, titleColor: C.ink,
      border: { pt: 1, color: C.line },
      fill: C.surface,
    },
  );

  const tiles = [
    ["What keeps slipping", "Items skipped or unlogged, ranked by frequency — exactly the input the planner rewrites.", C.danger],
    ["Stream breakdown", "Shows whether the gap is food, water or movement, so the fix targets the right one.", C.water],
    ["Streak & best day", "Consecutive days at 70%+ — progress framed as momentum, never as failure.", C.brand],
  ];
  tiles.forEach(([t, b, col], i) => {
    const x = 0.62 + i * 4.06;
    card(s, x, 4.72, 3.78, 1.62, { shadow: true });
    accent(s, x + 0.26, 4.95, 0.34, col);
    text(s, t, { x: x + 0.48, y: 4.92, w: 3.1, h: 0.3, fontSize: 12.5, bold: true, color: C.ink });
    text(s, b, { x: x + 0.28, y: 5.38, w: 3.28, h: 0.85, fontSize: 10.5, color: C.muted, lineSpacing: 15 });
  });
}

/* ---------------------------------------------------------------- 8 · voice */
{
  const s = slide("Optional upgrade", "It calls you in Gujarati when the task is due", 8,
    "A dashboard only helps if you open it. At each scheduled time, WellPath rings the phone.");

  const flow = [
    { t: "Scheduler", b: "30s tick finds\nthe due reminder", c: C.muted },
    { t: "Skip check", b: "Already checked in?\nNo call is placed", c: C.warn },
    { t: "GPT-4o-mini", b: "Writes the Gujarati\nline from live state", c: C.brand },
    { t: "Sarvam bulbul:v3", b: "8 kHz mono WAV\n+ 2s lead silence", c: C.water },
    { t: "Vobiz", b: "Places the call,\nplays, hangs up", c: C.exercise },
  ];
  flow.forEach((f, i) => {
    const x = 0.62 + i * 2.52;
    card(s, x, 1.88, 2.24, 1.5, { shadow: true });
    s.addShape(pptx.ShapeType.rect, {
      x, y: 1.88, w: 2.24, h: 0.075, fill: { color: f.c }, line: { width: 0 },
    });
    text(s, f.t, { x: x + 0.18, y: 2.1, w: 1.95, h: 0.3, fontSize: 12, bold: true, color: C.ink });
    text(s, f.b, { x: x + 0.18, y: 2.46, w: 1.95, h: 0.7, fontSize: 10, color: C.muted, lineSpacing: 14 });
    if (i < 4) arrow(s, x + 2.32, 2.52, 0.14, C.line);
  });

  card(s, 0.62, 3.62, 7.3, 1.72, { fill: C.ink, border: C.ink });
  text(s, "WHAT THE CALLER HEARS  ·  WATER REMINDER", {
    x: 0.92, y: 3.82, w: 6.6, h: 0.26, fontSize: 9.5, bold: true, color: "7FC2A0", charSpacing: 1.1,
  });
  text(s, "મનોજ, પાણી પી લો, તમારું ગળું સુકાઈ રહ્યું છે.\nઅત્યાર સુધી તમે 1000 મિલીલીટર પાણી પીધું છે.", {
    x: 0.92, y: 4.14, w: 6.6, h: 0.75, fontSize: 15, color: C.white, lineSpacing: 24,
  });
  text(s, "Every water call speaks that fixed line — enforced in the prompt, the template and a post-check.", {
    x: 0.92, y: 4.94, w: 6.6, h: 0.3, fontSize: 9.5, color: "9FB5A9", italic: true,
  });

  const notes = [
    ["Why the pause is in the audio", "Vobiz has no Wait verb — 2 s of PCM silence is spliced onto the WAV."],
    ["Hangs up on its own", "<Play> then <Hangup/> — no menu, nothing to press."],
    ["Schedule your own call", "Any time, any wording, once or daily — independent of the plan."],
  ];
  notes.forEach(([t, b], i) => {
    const y = 3.62 + i * 0.6;
    card(s, 8.16, y, 4.56, 0.54);
    text(s, t, { x: 8.36, y: y + 0.06, w: 4.2, h: 0.22, fontSize: 10.5, bold: true, color: C.ink });
    text(s, b, { x: 8.36, y: y + 0.27, w: 4.2, h: 0.24, fontSize: 8.8, color: C.muted });
  });

  card(s, 0.62, 5.52, 12.1, 0.92, { fill: C.brandSoft, border: C.brandSoft });
  text(s, "Reach, not just retention.", {
    x: 0.92, y: 5.68, w: 3.2, h: 0.3, fontSize: 13, bold: true, color: C.brandDeep,
  });
  text(s,
    "A voice call in the user's own language reaches people an English app notification never will — older users, low-literacy users, anyone who does not open a wellness app twice a day.",
    { x: 3.6, y: 5.7, w: 8.9, h: 0.6, fontSize: 11.5, color: C.brandDeep, lineSpacing: 16 },
  );
}

/* --------------------------------------------------------- 9 · architecture */
{
  const s = slide("Architecture", "Frontend, backend, data, AI and integrations", 9,
    "One Next.js process. SQLite on disk. Three external services, each with a fallback.");

  const layers = [
    { t: "CLIENT", c: C.brand,
      boxes: ["/register · /login", "/onboarding", "/today — check-ins", "/dashboard — charts", "/history"] },
    { t: "SERVER  ·  Next.js 16 route handlers", c: C.water,
      boxes: ["/api/auth/*", "/api/plan · /api/checkin", "/api/summary · /api/coach", "/api/reminders/*", "/telephony/* (webhooks)"] },
    { t: "DOMAIN  ·  pure TypeScript, no model calls", c: C.meal, wide: true,
      boxes: ["adherence.ts", "nutrition.ts", "services/plans.ts", "services/reminders.ts", "voice/scheduler.ts"] },
    { t: "DATA  ·  Prisma 7 + SQLite", c: C.exercise,
      boxes: ["User · Session", "Plan · PlanItem", "CheckIn · Feedback", "DailySummary", "Reminder"] },
  ];

  layers.forEach((L, i) => {
    const y = 1.74 + i * 1.10;
    text(s, L.t, { x: 0.62, y: y + 0.02, w: 5.6, h: 0.24, fontSize: 9.5, bold: true, color: L.c, charSpacing: 1 });
    L.boxes.forEach((b, j) => {
      const x = 0.62 + j * 2.44;
      card(s, x, y + 0.3, 2.28, 0.62, { fill: C.surface });
      accent(s, x + 0.14, y + 0.44, 0.34, L.c);
      text(s, b, { x: x + 0.3, y: y + 0.48, w: 1.9, h: 0.3, fontSize: 9.8, color: C.ink });
    });
  });

  const ext = [
    ["OpenAI  gpt-4o-mini", "plan · summary · coach · Gujarati script", C.brand],
    ["Sarvam  bulbul:v3 / saaras:v3", "Gujarati TTS at 8 kHz · optional STT", C.water],
    ["Vobiz  Voice API + XML", "outbound PSTN call · ngrok tunnel in dev", C.exercise],
  ];
  text(s, "INTEGRATIONS", {
    x: 0.62, y: 6.28, w: 3, h: 0.24, fontSize: 9.5, bold: true, color: C.muted, charSpacing: 1,
  });
  ext.forEach(([t, b, col], i) => {
    const x = 2.3 + i * 3.55;
    card(s, x, 6.18, 3.4, 0.6, { fill: C.surface });
    accent(s, x + 0.14, 6.31, 0.34, col);
    text(s, t, { x: x + 0.3, y: 6.26, w: 3.0, h: 0.24, fontSize: 10, bold: true, color: C.ink });
    text(s, b, { x: x + 0.3, y: 6.48, w: 3.0, h: 0.24, fontSize: 8.6, color: C.muted });
  });
}

/* ------------------------------------------- 10 · safety, resilience, ship */
{
  const s = slide("Safety, resilience & deliverables", "Built to survive the demo — and the guardrail", 10,
    "General wellness only, enforced in code. Every third-party failure has a visible fallback.");

  card(s, 0.62, 1.8, 6.05, 2.5, { shadow: true });
  accent(s, 0.88, 2.02, 0.42, C.danger);
  text(s, "Guardrails — enforced, not promised", {
    x: 1.1, y: 1.99, w: 5.2, h: 0.32, fontSize: 14.5, bold: true, color: C.ink,
  });
  const guards = [
    "Safety preamble on every prompt — no diagnosis, no medication, no clinical claims, ~1200 kcal floor.",
    "Red-flag screen blocks urgent input (chest pain, self-harm, disordered eating) before it reaches the model — and never stores it.",
    "Allergen gate audits generated meals against an alias table; a violation regenerates, then falls back.",
    "Ownership checked per object — another account's plan item returns 404, not data.",
  ];
  guards.forEach((g, i) => {
    const y = 2.5 + i * 0.44;
    text(s, "—", { x: 0.9, y, w: 0.2, h: 0.24, fontSize: 10, color: C.danger, bold: true });
    text(s, g, { x: 1.15, y, w: 5.3, h: 0.42, fontSize: 9.8, color: C.muted, lineSpacing: 13.5 });
  });

  card(s, 6.88, 1.8, 5.84, 2.5, { shadow: true });
  accent(s, 7.14, 2.02, 0.42, C.warn);
  text(s, "Fallback proof — if a service dies", {
    x: 7.36, y: 1.99, w: 5.2, h: 0.32, fontSize: 14.5, bold: true, color: C.ink,
  });
  const falls = [
    ["OpenAI down / rate-limited", "Rule-based planner produces a real, allergen-safe day using the same adjustment rules."],
    ["Model returns bad JSON", "Zod validation + corrective retry; loose times like \"8:00 AM\" are normalised, not rejected."],
    ["Sarvam or Vobiz unreachable", "Call is skipped and surfaced in the UI; the plan, check-ins and dashboard are unaffected."],
    ["No tunnel available", "In-browser audio preview plays the exact Gujarati WAV that would have been dialled."],
  ];
  falls.forEach(([t, b], i) => {
    const y = 2.5 + i * 0.44;
    text(s, t, { x: 7.16, y, w: 2.15, h: 0.4, fontSize: 9.5, bold: true, color: C.warn, lineSpacing: 12 });
    text(s, b, { x: 9.4, y, w: 3.15, h: 0.42, fontSize: 9, color: C.muted, lineSpacing: 12.5 });
  });

  card(s, 0.62, 4.48, 12.1, 1.35, { fill: C.surface });
  text(s, "MANDATORY DELIVERABLES", {
    x: 0.88, y: 4.62, w: 4, h: 0.24, fontSize: 9.5, bold: true, color: C.brand, charSpacing: 1,
  });
  const deliv = [
    ["Working product", "runs locally, 8787"],
    ["Core AI demo", "slide 06, reproducible"],
    ["Source code", "GitHub, 64 files"],
    ["README", "setup · stack · limits"],
    ["Architecture", "slide 09"],
    ["Safe demo data", "100% synthetic"],
    ["Fallback proof", "slide 10 + screenshots"],
  ];
  deliv.forEach(([t, b], i) => {
    const x = 0.88 + i * 1.71;
    s.addShape(pptx.ShapeType.ellipse, {
      x, y: 4.95, w: 0.26, h: 0.26, fill: { color: C.brandSoft }, line: { width: 0 },
    });
    text(s, "✓", { x, y: 4.985, w: 0.26, h: 0.2, fontSize: 10.5, bold: true, color: C.brand, align: "center" });
    text(s, t, { x, y: 5.28, w: 1.6, h: 0.24, fontSize: 9.8, bold: true, color: C.ink });
    text(s, b, { x, y: 5.5, w: 1.6, h: 0.24, fontSize: 8.6, color: C.muted });
  });

  card(s, 0.62, 5.96, 12.1, 0.86, { fill: C.brandDeep, border: C.brandDeep });
  text(s, "AI disclosure", {
    x: 0.92, y: 6.1, w: 1.6, h: 0.26, fontSize: 10.5, bold: true, color: "7FC2A0",
  });
  text(s,
    "OpenAI gpt-4o-mini (planning, summaries, coaching, Gujarati script)  ·  Sarvam bulbul:v3 TTS + saaras:v3 STT  ·  Vobiz Voice API.  " +
    "All demo data is synthetic. The team is responsible for all generated output.",
    { x: 2.45, y: 6.12, w: 10.1, h: 0.6, fontSize: 10, color: "C7E4D4", lineSpacing: 14 },
  );
}

await pptx.writeFile({ fileName: OUT });
console.log(`✓ ${OUT}`);
