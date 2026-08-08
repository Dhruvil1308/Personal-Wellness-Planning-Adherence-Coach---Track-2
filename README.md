# WellPath AI — Personal Wellness Planning & Adherence Coach

An AI wellness assistant that builds a personalised daily routine, runs meal / water /
exercise check-ins, and rewrites the next day's plan from what was actually recorded.

**General wellness only.** No diagnosis, no medication, no claim to replace a qualified
professional. That boundary is enforced in code, not just in copy — see
[Guardrails](#guardrails).

---

## Team

- **Dhruvil Prajapati**
- **Ronak Hinglajiya**
- **Vishva Patel**

Built collaboratively across four workstreams: the planning AI (`src/lib/ai/`), adherence
and gating (`adherence.ts`, `planGate.ts`), the Gujarati voice reminder pipeline
(Sarvam + Vobiz + `/telephony`), and platform work — auth, schema, design system and decks.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, React 19, TypeScript) |
| Styling | Tailwind CSS v4 |
| ORM / DB | Prisma 7 + SQLite (`better-sqlite3` driver adapter) |
| AI | OpenAI `gpt-4o-mini` — planning, adherence analysis, summaries, coaching |
| Voice | Sarvam `bulbul:v3` TTS + `saaras:v3` STT (Gujarati) |
| Telephony | Vobiz outbound calls + Voice XML |
| Charts | Recharts |
| Validation | Zod (API input **and** model output) |

## Run it

```bash
npm install
npx prisma migrate dev      # creates ./dev.db and applies the schema
npx prisma generate         # emits the client into src/generated/prisma

npm run dev                 # app on http://localhost:8787  (VOICE_HOST/VOICE_PORT)
npm run tunnel              # ngrok, in a second terminal — needed only for calls
```

The app listens on `8787` because that is what the ngrok tunnel forwards to; the
UI works without the tunnel, only outbound calls need it.

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

## AI services & credentials

Three external services. Each is disclosed here per the submission rules, and each has a
fallback so a dead key degrades one feature instead of the app.

| Service | Model / API | Used for | If the key is missing |
|---|---|---|---|
| **OpenAI** | `gpt-4o-mini` | Day planning, end-of-day summaries, coach chat, the Gujarati reminder line | Rule-based planner and deterministic summary take over; the UI still renders a full day |
| **Sarvam AI** | `bulbul:v3` TTS, `saaras:v3` STT | Gujarati speech at 8 kHz; STT only when response capture is enabled | Reminder audio cannot be rendered, so no call is placed — the plan and dashboard are unaffected |
| **Vobiz** | Voice API + Voice XML | Placing the outbound PSTN call | Calls are skipped and surfaced in the UI; in-browser preview still plays the exact WAV |

### Credentials needed

| Variable | Where it comes from |
|---|---|
| `OPENAI_API_KEY` | platform.openai.com |
| `SARVAM_API_KEY` | dashboard.sarvam.ai |
| `VOBIZ_AUTH_ID`, `VOBIZ_AUTH_TOKEN` | Vobiz console → API credentials |
| `VOBIZ_PHONE_NUMBER` | A number the Vobiz account may dial out from |
| `NGROK_DOMAIN`, `NGROK_AUTHTOKEN` | dashboard.ngrok.com — only for calls in local dev |

`.env.local` is gitignored and has never been committed; `.env.example` documents every
variable with no secrets. **No AI, cloud or API credits were sponsored** — all keys are
the team's own.

Point the Vobiz application's Answer and Hangup URLs at
`https://<your-domain>/telephony/answer` and `/telephony/hangup`.

### Demo data

100% synthetic. `POST /api/demo/seed` generates a fictional profile ("Aarav") and two
days of history with a scripted miss pattern. No real person's health data is present in
the repository or the database.

---

## The 3-minute demo

The brief's three proof points, in order:

**1. A user profile generates a complete daily plan.**
`/register` → username, password, name and mobile → fill the wellness profile →
**Generate this plan**.
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

## The 80% adherence gate

**A new day's plan is only generated once the previous planned day reaches 80%
completion.** Below that, the day is locked: `POST /api/plan` answers `423 Locked`
and `/today` shows the shortfall instead of a Generate button.

| Behaviour | Rule |
|---|---|
| Threshold | `PLAN_UNLOCK_THRESHOLD`, default `80` |
| Which day is judged | The most recent day *before* this one that has a plan — not `date - 1`, so a locked day cannot be skipped over by waiting |
| First ever plan | Always allowed — there is nothing to have completed |
| Existing plan | Never re-gated, so a day already underway can still be regenerated |
| Where it is enforced | Inside `ensurePlan()`, not the route, so no caller can create a plan around it |
| Recovery | The score is computed live — finish the blocking day and the gate opens by itself |

### Why there is an override

Taken literally the rule deadlocks. A locked day has no plan; a day with no plan has
nothing to check in on; so its score can never rise and the account is bricked after one
bad day. `POST /api/plan/unlock` is the documented way out, and every use is written to
the `PlanUnlock` table with the date, the score that was missed, the threshold and an
optional reason — so an override is visible afterwards rather than silent.

Verified end to end: first plan allowed → next day `423` at 0% → all items logged, day
hits 100% → next day generates on its own → a second locked day opens only after an
override, which then appears in the audit trail.

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

## Accounts & authentication

Registration collects the **login and the mobile number** first, then the wellness
profile:

```
/register  → username + password + name + mobile      (account exists, profileComplete = false)
/onboarding→ age, height, weight, goal, diet, …        (profileComplete = true)
/today     → the plan
```

`/login` signs back in; **Sign out** is in the header. A signed-out visitor hitting
`/today`, `/dashboard`, `/history` or `/onboarding` is redirected to `/login`, and
every API route answers `401` rather than serving data.

| Concern | How |
|---|---|
| Password storage | `scrypt` (N=16384, r=8, p=1) with a per-user 16-byte random salt, stored as `scrypt$N$r$p$salt$hash`. Node ships scrypt, so there is no dependency and no native build. |
| Session | A 32-byte random token in an `httpOnly`, `sameSite=lax` cookie (`secure` in production). Only its **SHA-256 hash** is stored, so a database dump does not yield live sessions. |
| Verification | `timingSafeEqual`, and a missing username still pays the hashing cost so it is not faster to detect. |
| Enumeration | Wrong password and unknown user return the identical `Wrong username or password`. |
| Brute force | 8 failed attempts per username per 15 minutes, then `429`. |
| Leakage | `publicUser()` strips `passwordHash` from every response that carries a user. |

**The old single-user fallback is gone.** `getCurrentUser()` used to return "the only
profile in the database" when the cookie was missing — harmless with one user, a
straight data leak with accounts. A missing or unknown token now resolves to `null`,
never to somebody else's account.

Ownership is checked on every object, not just at the door: fetching, checking in on
or previewing another account's plan item or reminder returns `404`.

---

## Gujarati reminder calls

At every scheduled time in the plan, WellPath phones the user and delivers the
reminder **in Gujarati**. The agent waits two seconds after pickup, reads the
reminder, and hangs up on its own — no menu, nothing to press.

### The flow

```
scheduler tick (30s)
  └─ reminder due?
       ├─ already checked in? ──────────────► SKIPPED, no call
       ├─ gpt-4o-mini writes the Gujarati line from live state
       ├─ Sarvam bulbul:v3 → 8 kHz mono WAV, 2s silence spliced on the front
       └─ Vobiz POST /Call/  ──► rings the user
              ├─ ring_url    ──► RINGING
              ├─ answer_url  ──► <Response><Play>…wav</Play><Hangup/></Response>
              └─ hangup_url  ──► COMPLETED (+ duration), audio deleted
```

### Why the pause lives in the audio

Vobiz's documented verb set is `Gather / Dial / Speak / Play / Record / Stream /
Redirect / Hangup` — there is no `Wait`. So rather than depend on an
undocumented verb, `src/lib/voice/wav.ts` splices exactly two seconds of PCM
silence onto the front of the synthesised file. The pause is then exact and
carrier-independent. Measured on a real render: `2.009s` of leading silence on a
12.58s file.

### The script is written per call, not per plan

The Gujarati line is generated **at dispatch time**, so it reflects live
progress rather than restating the plan. Same hydration reminder, different
states:

| Logged | Spoken line |
|---|---|
| 0 / 3300 ml | આરવ, તે સમયે પાણી પીવાની યાદી છે. આજે તમારે ૩૩૦૦ મિલિલિટર પાણી પીનુ છે… |
| 1000 / 3300 ml | નમસ્તે આરવ… આજે તને ૨૩૦૦ મિલીલિટર પાણી પીવું છે, તો હવે એક ગ્લાસ પી લે. |
| 3300 / 3300 ml | આરવ, આજે તું પાણી પીવાના લક્ષ્યને પૂરી કરી લીધો છે. ખૂબ સરસ! |

The prompt states the facts as **conclusions** ("Target met? NO") rather than
numbers to interpret, and forbids inventing a place, equipment or ingredient —
an earlier, looser version congratulated the user at 0 ml and put a
no-equipment profile "at the gym". A Gujarati template backs it up, and a reply
containing no Gujarati characters is rejected in favour of that template so a
model drifting to English can never reach the phone.

### Setup — ngrok + the Vobiz application

Vobiz reaches this server over a tunnel, and the Vobiz application's URLs are
fixed, so the routes match them exactly:

| Vobiz console | Route |
|---|---|
| Primary Answer URL (POST) | `https://<domain>/telephony/answer` |
| Hangup URL (POST) | `https://<domain>/telephony/hangup` |
| Fallback Answer URL (POST) | `https://<domain>/telephony/answer` |

```bash
ngrok config add-authtoken <your-token>   # once
npm run dev      # terminal 1 — app on 0.0.0.0:8787
npm run tunnel   # terminal 2 — publishes NGROK_DOMAIN -> localhost:8787
```

`NGROK_DOMAIN` is the origin handed to the carrier. `PUBLIC_BASE_URL` is only
the **local** address the tunnel forwards to and is never given out — pointing
Vobiz at `http://localhost:8787` would be a call to dead air, so the readiness
check treats a localhost value as "not reachable" and refuses to dial.

**Matching a callback to a reminder.** The Vobiz application holds one Answer
URL for every call, so `src/lib/voice/resolve.ts` identifies the reminder by, in
order: the `?rid=` we attach to the per-call `answer_url`, then `RequestUUID`,
then `CallUUID`, then the destination number with a call in flight. That means
the webhooks work whether Vobiz uses our per-call URL or the application-level
default with no query string.

Without a tunnel the app still renders and **previews** the Gujarati audio in the
browser; it just refuses to dial. The answer webhook builds its `<Play>` URL from
the origin the carrier actually reached it on, so a restarted tunnel does not
break a call already in flight.

### Reminder API

| Route | Purpose |
|---|---|
| `GET /api/reminders?date=` | Scheduled calls, settings, readiness, scheduler status |
| `POST /api/reminders` | Save phone / on-off, re-sync calls to the plan |
| `POST /api/reminders/custom` | **Schedule a call at a time you pick** (`ONCE` or `DAILY`) |
| `POST /api/reminders/[id]` | `preview` · `call-now` · `cancel` · `reschedule` |
| `POST /api/reminders/tick` | Run one scheduler pass (for external cron) |
| `POST /telephony/answer` | Returns the Voice XML — **public webhook, set in the Vobiz console** |
| `POST /telephony/ring` · `/telephony/hangup` | Call state — **public webhooks** |
| `POST /telephony/recording` | Saaras transcription — only when capture is on |
| `GET /telephony/audio/[id]` | Serves the WAV to the carrier — **public** |
| `GET /api/voice/audio/[id]` | Same WAV for the in-browser preview player |

`preview` renders the line and audio and plays it in the browser **without
dialling**, which is also how you demo the voice with no tunnel.

### Calls you schedule yourself

Beyond the one-per-plan-item calls, **+ Schedule a call at a specific time** takes a
time, a subject, an optional note and `Once` / `Every day`. These have no plan item,
so:

- a plan re-sync never touches them (only rows with a `planItemId` are reconciled);
- the Gujarati line is built from *your* wording, and the prompt is explicitly told
  there is no target or quantity — an earlier version reached for the hydration
  block and told the user they had "0 ml left to drink";
- `DAILY` arms tomorrow's copy as soon as today's call goes out.

### Behaviour worth knowing

- **Already checked in → no call.** Resolved before the telephony checks: if the
  user has done the thing, whether calling is configured is irrelevant.
- **Late reminders are not placed.** Anything more than
  `REMINDER_MAX_LATE_MINUTES` (30) past its slot is `EXPIRED` — nobody wants a
  breakfast call at 11pm because the laptop was asleep.
- **Regenerating a plan moves the calls.** Reminders are keyed to plan items, so
  a rescheduled item moves its call and a removed item drops it. Calls already
  dialled are never rewritten.
- **Times are wall-clock in the server's timezone** — run it in IST.
- **STT is opt-in.** `REMINDER_CAPTURE_RESPONSE=true` records a short reply,
  transcribes it with `saaras:v3` and files it as a check-in note the planner
  then reads. Default is off, matching the remind-then-hang-up spec.

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

`User → Plan → PlanItem → CheckIn`, plus `Feedback` and `DailySummary` per plan,
`CoachMessage` and `Reminder` per user, and `Session` for logins.

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
| `POST /api/auth/register` | Create an account (username, password, name, mobile) |
| `POST /api/auth/login` · `logout` | Start / end a session |
| `GET /api/auth/me` | The signed-in user |
| `GET/POST /api/profile` | Read / update the wellness profile (screened) |
| `GET /api/plan?date=` | Plan + computed adherence for a day |
| `POST /api/plan` | Generate a day (`{ date?, force? }`) — `423` when the 80% gate is closed |
| `GET/POST /api/plan/unlock` | Read the override audit trail / override the gate for one day |
| `POST/DELETE /api/checkin` | Log or undo a check-in |
| `POST /api/feedback` | Daily energy / difficulty / hunger / mood / notes |
| `GET/POST /api/summary` | Read / build the end-of-day summary |
| `GET /api/dashboard` | Trend, stream averages, streak, trouble spots |
| `GET/POST /api/coach` | Coach chat |
| `POST /api/demo/seed` | Seed 2 days of history with a deliberate miss pattern |
| `POST /api/demo/reset` | Delete the profile and everything under it |

Every route above requires a session; see [Accounts & authentication](#accounts--authentication).

---

## Known limits

- No email verification or password reset — a forgotten password means a new account.
- Login throttling is in-memory, so it resets on restart and is per-node.
- Optional upgrades from the brief: scheduled reminders, progress visualisation and
  regional meal options are **built**. The expert-review workflow is **not**.
- Reminder times are wall-clock and resolve against the server's timezone, so the server
  should run in the user's timezone (IST here).
- The 80% gate is strict by design; without the recorded override a single bad day would
  lock the account permanently.
- Calorie and hydration figures are population estimates (Mifflin-St Jeor, ~33 ml/kg)
  used to keep the model inside sensible bounds — they are not clinical targets.
