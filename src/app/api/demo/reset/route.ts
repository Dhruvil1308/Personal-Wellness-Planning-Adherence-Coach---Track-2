import { prisma } from "@/lib/db";
import { handleError, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";

/**
 * Clears the signed-in user's wellness data — plans, check-ins, summaries,
 * feedback, coach history and scheduled calls — while keeping the account and
 * the session. Deleting the account itself is not something a demo button
 * should do behind a single confirm.
 */
export async function POST() {
  try {
    const user = await requireUser();

    // Plans cascade to items, check-ins, summaries, feedback and reminders.
    await prisma.plan.deleteMany({ where: { userId: user.id } });
    await prisma.reminder.deleteMany({ where: { userId: user.id } });
    await prisma.coachMessage.deleteMany({ where: { userId: user.id } });

    return ok({ reset: true, keptAccount: user.username });
  } catch (err) {
    return handleError(err);
  }
}
