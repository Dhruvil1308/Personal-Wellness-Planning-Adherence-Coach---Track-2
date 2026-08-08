# WellPath AI — Personal Wellness Planning & Adherence Coach

An AI wellness assistant that builds a personalised daily routine, runs meal / water /
exercise check-ins, and rewrites the next day's plan from what was actually recorded.

**General wellness only.** No diagnosis, no medication, no claim to replace a qualified
professional. That boundary is enforced in code, not just in copy — see
[Guardrails](#guardrails).

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, React 19, TypeScript) |
| Styling | Tailwind CSS v4 |
| ORM / DB | Prisma 7 + SQLite (`better-sqlite3` driver adapter) |
| AI | OpenAI `gpt-4o-mini` — planning, adherence analysis, summaries, coaching |
| Charts | Recharts |
| Validation | Zod (API input **and** model output) |

## Run it

```bash
npm install
npx prisma migrate dev      # creates ./dev.db and applies the schema
npx prisma generate         # emits the client into src/generated/prisma
npm run dev                 # http://localhost:3000
```

Environment (`.env.local`, see `.env.example`):

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
LLM_TEMPERATURE=0.6
LLM_MAX_TOKENS=200          # short coach replies
LLM_MAX_TOKENS_PLAN=2600    # a full day plan is structured JSON — needs its own budget
LLM_MAX_TOKENS_SUMMARY=800
```

`DATABASE_URL="file:./dev.db"` lives in `.env` and is read by both the Prisma CLI and
the Next.js server.

---

## The 3-minute demo

The brief's three proof points, in order:

**1. A user profile generates a complete daily plan.**
`/onboarding` → fill the profile → **Create my profile** → **Generate this plan**.
The plan lands with meals, one hydration target and movement, each carrying a
`Why this?` line, plus a "Why this plan" rationale for the whole day.

**2. Missed tasks change the next recommendation.**
On `/today`, hit **Seed 2 days of history** in the Demo tools card. That writes two
past days where the workout was skipped both days, breakfast went unlogged, and
hydration stalled near 40% — then clears today. Now hit **Generate this plan** and read
the green **"What changed since …"** block. In a representative run it produced:

> *Replaced the Banana Oats Smoothie with a quicker option, 'Fruit and Yogurt Parfait',
> to address breakfast skipping. Shortened the workout to 15 minutes to make it more
> achievable, given the challenges with longer sessions.*

That is the model reading the check-in record and the feedback notes, not a template.

**3. The dashboard explains adherence clearly.**
`/dashboard` shows the average as a ring, then decomposes it: which stream, at what
weight, from which check-ins. **What keeps slipping** ranks the items missed most often
— which is precisely the input the planner rewrites.

`/history` shows the whole chain: each day's plan, its adjustment note, its recorded
misses, its summary and the feedback that fed the next day.

---

## Where the AI actually does the work

`src/lib/ai/` — every model call is here, none of it decorative.

| File | Job |
|---|---|
| `planner.ts` | Builds a day from the profile **plus the last 3 days of recorded adherence and feedback**. The prompt requires a per-item `why` and a specific `adjustmentNote` naming the change *and its evidence*. |
| `summarizer.ts` | End-of-day recap. Hard-constrained to the recorded data — an item that was never logged is reported as *not logged*, never assumed. |
| `coach.ts` | Check-in chat. Reads the day's real numbers before replying; one small next action, no shaming. |
| `guardrails.ts` | Scope boundary (below). |
| `allergens.ts` | Deterministic allergen gate over generated meals. |
| `fallback.ts` | Rule-based planner used when a model call fails. |
| `schemas.ts` | Zod schemas the model output must satisfy. |

**Adherence itself is not AI.** `src/lib/adherence.ts` computes it deterministically from
check-in rows, and the result is what gets fed to the model — so the numbers on screen
and the numbers the model reasons over are the same numbers.

### Reliability

- Model output is parsed and **validated against a Zod schema**, with a retry that tells
  the model what it got wrong. Loose times (`8:00 AM`, `13:00-13:30`) are normalised
  rather than rejected.
- If the model still fails — bad key, outage, rate limit, truncation — `fallback.ts`
  produces a real plan using the same adjustment rules, and the UI labels it
  **⚙ Rule-based fallback** instead of **✦ AI generated**. The app never shows an empty day.

---

## Guardrails

1. **`SAFETY_PREAMBLE`** prepends every system prompt: no diagnosis, no medication, no
   symptom interpretation, no replacing a professional, no extreme restriction, a
   ~1200 kcal/day floor, and a conservative posture around pain, injury, pregnancy,
   disordered eating and mental health.
2. **`screenUserText()`** is a deterministic pre-check on free text (profile notes,
   feedback, chat). Urgent categories — possible acute symptoms, self-harm, disordered
   eating — are **blocked before reaching the model** and replaced with a referral. Those
   exchanges are deliberately never persisted, so a crisis disclosure cannot leak into
   the context of a later reply.
3. **Non-urgent flags** (a clinical question, pregnancy) don't block; they append a
   caution to the planning prompt and force a referral line into the reply.
4. **Allergen gate.** `auditPlanForAllergens()` scans generated meals against the stated
   allergies plus an alias table (`peanut` → `groundnut`; `dairy` → `paneer`, `ghee`, …).
   A violation triggers one corrective regeneration, then falls back to the rule-based
   planner. The fallback planner picks per-slot options that clear the diet, allergies
   and dislikes before it emits anything.

---

## Data model

`User → Plan → PlanItem → CheckIn`, plus `Feedback` and `DailySummary` per plan and
`CoachMessage` per user.

Day keys are `YYYY-MM-DD` strings, never `Date`, so a day cannot shift under a timezone
conversion. Water is modelled as **one** `PlanItem` with many `CheckIn` rows that
accumulate; meals and exercise hold a single replaceable check-in.

### Adherence maths (`src/lib/adherence.ts`)

- Per item: `DONE` = 1, `PARTIAL` = 0.5, `SKIPPED` / never-logged = 0. A logged quantity
  beats the status bucket (25 of a 30-minute walk scores 0.83, not 1).
- Per stream: the mean of its items. Hydration is millilitres logged ÷ target.
- Overall: weighted `meals 45% / hydration 20% / movement 35%`, with streams the plan
  doesn't contain dropped and the weights renormalised.

---

## API

| Route | Purpose |
|---|---|
| `GET/POST /api/profile` | Read / create / update the profile (screened) |
| `GET /api/plan?date=` | Plan + computed adherence for a day |
| `POST /api/plan` | Generate a day (`{ date?, force? }`) |
| `POST/DELETE /api/checkin` | Log or undo a check-in |
| `POST /api/feedback` | Daily energy / difficulty / hunger / mood / notes |
| `GET/POST /api/summary` | Read / build the end-of-day summary |
| `GET /api/dashboard` | Trend, stream averages, streak, trouble spots |
| `GET/POST /api/coach` | Coach chat |
| `POST /api/demo/seed` | Seed 2 days of history with a deliberate miss pattern |
| `POST /api/demo/reset` | Delete the profile and everything under it |

Session is a single `wellpath_uid` cookie — no auth layer, by design, for a demo.

---

## Known limits

- Single profile per browser; no accounts, no multi-user.
- Optional upgrades from the brief that are **not** built: scheduled reminders,
  expert-review workflow. Regional meal options and progress visualisation are in.
- Calorie and hydration figures are population estimates (Mifflin-St Jeor, ~33 ml/kg)
  used to keep the model inside sensible bounds — they are not clinical targets.
