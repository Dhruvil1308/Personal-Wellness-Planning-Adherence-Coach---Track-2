import { prisma } from "@/lib/db";
import { readCallbackParams } from "@/lib/voice/callback";
import { rememberCallIdentifiers, resolveReminder } from "@/lib/voice/resolve";

export const dynamic = "force-dynamic";

/** Vobiz notifies this when the destination starts ringing. */
export async function POST(req: Request) {
  try {
    const params = await readCallbackParams(req);
    const reminder = await resolveReminder(req, params);
    if (!reminder) return new Response(null, { status: 204 });

    // The CallUUID first appears here; storing it lets the later callbacks match
    // even when they arrive without our `?rid=` query.
    await rememberCallIdentifiers(reminder.id, params);
    await prisma.reminder
      .update({ where: { id: reminder.id }, data: { status: "RINGING" } })
      .catch(() => null);
  } catch (err) {
    console.error("[voice] ring failed:", err);
  }

  return new Response(null, { status: 204 });
}

export async function GET(req: Request) {
  return POST(req);
}
