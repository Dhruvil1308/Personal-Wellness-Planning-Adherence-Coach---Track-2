import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, handleError, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/session";
import { coachReply } from "@/lib/ai/coach";
import { computeAdherence, type PlanWithItems } from "@/lib/adherence";
import { getPlan } from "@/lib/services/plans";
import { today } from "@/lib/date";

const bodySchema = z.object({ message: z.string().trim().min(1).max(600) });

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return ok({ messages: [] });
    const messages = await prisma.coachMessage.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
    return ok({ messages });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("Create a profile first", 404);

    const { message } = bodySchema.parse(await req.json());

    const plan = await getPlan(user.id, today());
    const adherence = plan ? computeAdherence(plan as PlanWithItems) : null;

    const history = await prisma.coachMessage.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 6,
    });

    const { reply, blocked, generatedBy } = await coachReply({
      user,
      adherence,
      history: history.reverse().map((m) => ({ role: m.role, content: m.content })),
      message,
    });

    // A blocked exchange is deliberately not persisted: it never reached the
    // model, it should not be stored, and leaving it in history would carry a
    // crisis disclosure into the context of every later reply.
    if (!blocked) {
      await prisma.coachMessage.createMany({
        data: [
          { userId: user.id, role: "user", content: message },
          { userId: user.id, role: "coach", content: reply },
        ],
      });
    }

    return ok({ reply, blocked, generatedBy });
  } catch (err) {
    return handleError(err);
  }
}
