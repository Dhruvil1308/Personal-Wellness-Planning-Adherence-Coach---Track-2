import { prisma } from "@/lib/db";
import { handleError, ok } from "@/lib/api";
import { getCurrentUser, setSessionUserId } from "@/lib/session";
import { buildDailySummary, ensurePlan, getPlan } from "@/lib/services/plans";
import { shiftDay, today } from "@/lib/date";
import type { User } from "@/generated/prisma/client";

/**
 * Seeds two days of history with a deliberate, readable pattern of misses so
 * the adjustment behaviour is demonstrable in one click:
 *   - the morning workout is skipped on both days
 *   - breakfast is skipped on the older day and eaten late on the newer one
 *   - hydration lands around half the target
 * Today is intentionally left empty so the plan generated next visibly reacts.
 */

const DEMO_PROFILE = {
  name: "Aarav",
  ageRange: "25-34",
  sex: "male",
  heightCm: 174,
  weightKg: 82,
  goal: "weight_loss",
  activityLevel: "sedentary",
  dietaryPreference: "vegetarian",
  cuisine: "north_indian",
  allergies: "peanuts",
  dislikes: "bitter gourd",
  limitations: "desk job, mild knee discomfort on stairs",
  equipment: "none",
  wakeTime: "07:00",
  sleepTime: "23:30",
  workoutWindowMin: 30,
};

type DayScript = {
  offset: number;
  skipBreakfast: boolean;
  waterRatio: number;
  feedback: { energy: number; difficulty: number; hunger: number; mood: string; notes: string };
};

const SCRIPT: DayScript[] = [
  {
    offset: -2,
    skipBreakfast: true,
    waterRatio: 0.4,
    feedback: {
      energy: 2,
      difficulty: 4,
      hunger: 4,
      mood: "drained",
      notes:
        "Skipped the workout again — a 30 minute block is more than I can commit to. Also had no time to eat in the morning and was starving by 11.",
    },
  },
  {
    offset: -1,
    skipBreakfast: true,
    waterRatio: 0.45,
    feedback: {
      energy: 3,
      difficulty: 4,
      hunger: 4,
      mood: "okay",
      notes:
        "Same story with the workout. Something around 15 minutes would actually happen. Breakfast keeps getting skipped too.",
    },
  },
];

/**
 * The demo needs guaranteed, repeated misses regardless of how the model
 * scheduled the day, so this targets items structurally (the first movement
 * block, the earliest meal) rather than by time or exact slot spelling.
 */
async function applyCheckIns(userId: string, date: string, script: DayScript) {
  const plan = await getPlan(userId, date);
  if (!plan) return;

  const byTime = [...plan.items].sort((a, b) =>
    a.scheduledTime.localeCompare(b.scheduledTime),
  );
  const firstExercise = byTime.find((i) => i.type === "EXERCISE");
  const breakfast =
    byTime.find((i) => i.type === "MEAL" && (i.slot ?? "").toLowerCase().includes("breakfast")) ??
    byTime.find((i) => i.type === "MEAL");

  for (const item of plan.items) {
    await prisma.checkIn.deleteMany({ where: { planItemId: item.id } });

    if (item.type === "WATER") {
      const target = item.targetQty ?? 2500;
      const glasses = Math.max(1, Math.round((target * script.waterRatio) / 250));
      for (let i = 0; i < glasses; i++) {
        await prisma.checkIn.create({
          data: { planItemId: item.id, status: "DONE", actualQty: 250 },
        });
      }
      continue;
    }

    if (firstExercise && item.id === firstExercise.id) {
      await prisma.checkIn.create({
        data: {
          planItemId: item.id,
          status: "SKIPPED",
          note: `Couldn't get to this at ${item.scheduledTime} — the block is too long for me`,
        },
      });
      continue;
    }

    if (script.skipBreakfast && breakfast && item.id === breakfast.id) {
      await prisma.checkIn.create({
        data: {
          planItemId: item.id,
          status: "SKIPPED",
          note: "No time to eat before leaving",
        },
      });
      continue;
    }

    await prisma.checkIn.create({
      data: { planItemId: item.id, status: "DONE", actualQty: item.targetQty ?? null },
    });
  }
}

export async function POST() {
  try {
    let user: User | null = await getCurrentUser();
    if (!user) {
      user = await prisma.user.create({ data: DEMO_PROFILE });
      await setSessionUserId(user.id);
    }

    const base = today();
    const seeded: string[] = [];

    for (const script of SCRIPT) {
      const date = shiftDay(base, script.offset);
      await ensurePlan(user, date, { force: true });
      await applyCheckIns(user.id, date, script);

      const plan = await getPlan(user.id, date);
      if (plan) {
        const data = { userId: user.id, planId: plan.id, date, ...script.feedback };
        await prisma.feedback.upsert({
          where: { planId: plan.id },
          create: data,
          update: data,
        });
      }

      await buildDailySummary(user, date);
      seeded.push(date);
    }

    // Leave today blank so the next generated plan visibly reacts to the misses.
    const existingToday = await getPlan(user.id, base);
    if (existingToday) await prisma.plan.delete({ where: { id: existingToday.id } });

    return ok({ user, seeded, todayCleared: true });
  } catch (err) {
    return handleError(err);
  }
}
