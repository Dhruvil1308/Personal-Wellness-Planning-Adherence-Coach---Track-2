export const ITEM_TYPES = ["MEAL", "WATER", "EXERCISE"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const CHECKIN_STATUSES = ["DONE", "PARTIAL", "SKIPPED"] as const;
export type CheckInStatus = (typeof CHECKIN_STATUSES)[number];

export const AGE_RANGES = [
  "13-17",
  "18-24",
  "25-34",
  "35-44",
  "45-54",
  "55-64",
  "65+",
] as const;

export const GOALS = [
  { value: "weight_loss", label: "Gentle weight loss" },
  { value: "muscle_gain", label: "Build strength / muscle" },
  { value: "maintain", label: "Maintain & stay consistent" },
  { value: "energy", label: "More daily energy" },
  { value: "stress", label: "Lower stress, better sleep" },
] as const;

export const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "Sedentary (desk job, little movement)" },
  { value: "light", label: "Lightly active (some walking)" },
  { value: "moderate", label: "Moderately active (3-4 workouts/week)" },
  { value: "active", label: "Very active (daily training / physical job)" },
] as const;

export const DIET_PREFS = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "eggetarian", label: "Eggetarian" },
  { value: "non_veg", label: "Non-vegetarian" },
  { value: "jain", label: "Jain (no root vegetables)" },
] as const;

export const CUISINES = [
  { value: "north_indian", label: "North Indian" },
  { value: "south_indian", label: "South Indian" },
  { value: "gujarati", label: "Gujarati" },
  { value: "bengali", label: "Bengali" },
  { value: "mediterranean", label: "Mediterranean" },
  { value: "global", label: "No preference / global" },
] as const;

export const EQUIPMENT = [
  { value: "none", label: "Nothing — bodyweight only" },
  { value: "bands", label: "Resistance bands" },
  { value: "dumbbells", label: "Dumbbells at home" },
  { value: "full_gym", label: "Full gym access" },
] as const;

export const SEXES = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other / prefer not to say" },
] as const;

/** Weights used when rolling the three streams into one adherence number. */
export const ADHERENCE_WEIGHTS = { meal: 0.45, water: 0.2, exercise: 0.35 };

export function labelFor(
  list: ReadonlyArray<{ value: string; label: string }>,
  value: string,
) {
  return list.find((o) => o.value === value)?.label ?? value;
}
