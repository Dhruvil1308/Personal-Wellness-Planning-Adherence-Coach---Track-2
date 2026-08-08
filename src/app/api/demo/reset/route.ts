import { prisma } from "@/lib/db";
import { handleError, ok } from "@/lib/api";
import { clearSession, getCurrentUser } from "@/lib/session";

/** Wipes the current demo profile and everything cascading from it. */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (user) await prisma.user.delete({ where: { id: user.id } });
    await clearSession();
    return ok({ reset: true });
  } catch (err) {
    return handleError(err);
  }
}
