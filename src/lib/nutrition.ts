import type { User } from "@/generated/prisma/client";

/**
 * Rough, non-clinical energy/hydration reference points used only to keep the
 * AI plan inside sensible bounds. These are population estimates for general
 * wellness planning — never presented to the user as a medical prescription.
 */

const AGE_MIDPOINT: Record<string, number> = {
  "13-17": 16,
  "18-24": 21,
  "25-34": 30,
  "35-44": 40,
  "45-54": 50,
  "55-64": 60,
  "65+": 70,
};

const ACTIVITY_FACTOR: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

const GOAL_DELTA: Record<string, number> = {
  weight_loss: -400,
  muscle_gain: +250,
  maintain: 0,
  energy: 0,
  stress: 0,
};

const PROTEIN_PER_KG: Record<string, number> = {
  weight_loss: 1.6,
  muscle_gain: 1.8,
  maintain: 1.2,
  energy: 1.2,
  stress: 1.2,
};

export type Targets = {
  age: number;
  bmi: number;
  bmiBand: string;
  maintenanceKcal: number;
  calorieTarget: number;
  proteinTargetG: number;
  hydrationTargetMl: number;
};

export function estimateTargets(user: User): Targets {
  const age = AGE_MIDPOINT[user.ageRange] ?? 30;
  const h = user.heightCm;
  const w = user.weightKg;

  // Mifflin-St Jeor; the "other/unspecified" case averages the two constants.
  const sexConstant =
    user.sex === "male" ? 5 : user.sex === "female" ? -161 : -78;
  const bmr = 10 * w + 6.25 * h - 5 * age + sexConstant;

  const factor = ACTIVITY_FACTOR[user.activityLevel] ?? 1.375;
  const maintenanceKcal = Math.round(bmr * factor);

  const floor = user.sex === "male" ? 1500 : 1200;
  const calorieTarget = Math.max(
    floor,
    Math.round((maintenanceKcal + (GOAL_DELTA[user.goal] ?? 0)) / 10) * 10,
  );

  const proteinTargetG = Math.round(w * (PROTEIN_PER_KG[user.goal] ?? 1.2));

  // ~33 ml/kg, nudged up for higher activity, rounded to the nearest 100ml.
  const activityBump = user.activityLevel === "active" ? 500 : user.activityLevel === "moderate" ? 300 : 0;
  const hydrationTargetMl = Math.min(
    4000,
    Math.max(1800, Math.round((w * 33 + activityBump) / 100) * 100),
  );

  const bmi = w / Math.pow(h / 100, 2);
  const bmiBand =
    bmi < 18.5
      ? "below the typical range"
      : bmi < 25
        ? "within the typical range"
        : bmi < 30
          ? "above the typical range"
          : "well above the typical range";

  return {
    age,
    bmi: Math.round(bmi * 10) / 10,
    bmiBand,
    maintenanceKcal,
    calorieTarget,
    proteinTargetG,
    hydrationTargetMl,
  };
}
