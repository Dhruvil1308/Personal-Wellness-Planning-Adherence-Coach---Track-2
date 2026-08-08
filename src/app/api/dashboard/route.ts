import { fail, handleError, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/session";
import { getInsights } from "@/lib/services/insights";
import { isValidDayKey, today } from "@/lib/date";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("Create a profile first", 404);

    const url = new URL(req.url);
    const end = url.searchParams.get("end") ?? today();
    const days = Math.min(30, Math.max(3, Number(url.searchParams.get("days") ?? 14)));
    if (!isValidDayKey(end)) return fail("Invalid end date", 422);

    return ok(await getInsights(user.id, end, days));
  } catch (err) {
    return handleError(err);
  }
}
