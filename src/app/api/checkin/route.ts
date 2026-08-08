import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, handleError, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/session";
import { CHECKIN_STATUSES } from "@/lib/constants";
import { computeAdherence, type PlanWithItems } from "@/lib/adherence";
import { getPlan } from "@/lib/services/plans";

const checkInSchema = z.object({
  planItemId: z.string().min(1),
  status: z.enum(CHECKIN_STATUSES),
  actualQty: z.number().nonnegative().max(10000).optional().nullable(),
  note: z.string().max(300).optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("Create a profile first", 404);

    const body = checkInSchema.parse(await req.json());

    const item = await prisma.planItem.findUnique({
      where: { id: body.planItemId },
      include: { plan: true },
    });
    if (!item || item.plan.userId !== user.id) return fail("Item not found", 404);

    if (item.type === "WATER") {
      // Water accumulates — every glass is its own row.
      await prisma.checkIn.create({
        data: {
          planItemId: item.id,
          status: body.status,
          actualQty: body.actualQty ?? item.targetQty ?? 0,
          note: body.note ?? null,
        },
      });
    } else {
      // Meals and exercise hold one answer: replace it so re-logging corrects.
      await prisma.checkIn.deleteMany({ where: { planItemId: item.id } });
      await prisma.checkIn.create({
        data: {
          planItemId: item.id,
          status: body.status,
          actualQty: body.actualQty ?? (body.status === "DONE" ? item.targetQty : null),
          note: body.note ?? null,
        },
      });
    }

    const plan = await getPlan(user.id, item.plan.date);
    return ok({
      adherence: computeAdherence(plan as PlanWithItems),
      date: item.plan.date,
    });
  } catch (err) {
    return handleError(err);
  }
}

/** Undo — clears the check-ins on an item so it returns to pending. */
export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("Create a profile first", 404);

    const url = new URL(req.url);
    const planItemId = url.searchParams.get("planItemId");
    if (!planItemId) return fail("planItemId is required", 422);

    const item = await prisma.planItem.findUnique({
      where: { id: planItemId },
      include: { plan: true },
    });
    if (!item || item.plan.userId !== user.id) return fail("Item not found", 404);

    await prisma.checkIn.deleteMany({ where: { planItemId } });

    const plan = await getPlan(user.id, item.plan.date);
    return ok({ adherence: computeAdherence(plan as PlanWithItems), date: item.plan.date });
  } catch (err) {
    return handleError(err);
  }
}
