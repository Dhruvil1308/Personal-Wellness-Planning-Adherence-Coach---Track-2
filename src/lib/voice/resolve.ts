import { prisma } from "@/lib/db";
import { pick } from "@/lib/voice/callback";
import { toDialFormat } from "@/lib/voice/vobiz";
import type { Reminder } from "@/generated/prisma/client";

/**
 * The Vobiz application holds ONE Answer URL for every call, so the webhook has
 * to work out which reminder it belongs to. In order of reliability:
 *
 *  1. `?rid=` — set on the answer_url we pass per call, so it is present
 *     whenever Vobiz uses our URL rather than the app-level default.
 *  2. RequestUUID — returned by the Call API and stored at dispatch.
 *  3. CallUUID — learned from the ring callback.
 *  4. The destination number with a call in flight — the last resort for a call
 *     placed from the app-level URL with no query string at all.
 */
export async function resolveReminder(
  req: Request,
  params: Record<string, string>,
): Promise<Reminder | null> {
  const rid = new URL(req.url).searchParams.get("rid");
  if (rid) {
    const byId = await prisma.reminder.findUnique({ where: { id: rid } });
    if (byId) return byId;
  }

  const requestUuid = pick(params, "RequestUUID", "request_uuid");
  if (requestUuid) {
    const byRequest = await prisma.reminder.findFirst({ where: { requestUuid } });
    if (byRequest) return byRequest;
  }

  const callUuid = pick(params, "CallUUID", "call_uuid");
  if (callUuid) {
    const byCall = await prisma.reminder.findFirst({ where: { callUuid } });
    if (byCall) return byCall;
  }

  const to = pick(params, "To", "to", "ToNumber", "to_number");
  if (to) {
    const dialled = toDialFormat(to);
    // Only rows that are mid-call, newest first — never an old completed one.
    const inFlight = await prisma.reminder.findMany({
      where: { status: { in: ["DISPATCHING", "RINGING", "ANSWERED"] } },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });
    const match = inFlight.find((r) => toDialFormat(r.toNumber) === dialled);
    if (match) return match;
  }

  return null;
}

/** Records identifiers the carrier hands back so later callbacks can match. */
export async function rememberCallIdentifiers(
  reminderId: string,
  params: Record<string, string>,
) {
  const callUuid = pick(params, "CallUUID", "call_uuid");
  const requestUuid = pick(params, "RequestUUID", "request_uuid");
  if (!callUuid && !requestUuid) return;

  await prisma.reminder
    .update({
      where: { id: reminderId },
      data: {
        ...(callUuid ? { callUuid } : {}),
        ...(requestUuid ? { requestUuid } : {}),
      },
    })
    .catch(() => null);
}
