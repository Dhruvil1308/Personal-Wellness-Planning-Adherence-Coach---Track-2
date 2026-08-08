import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, handleError, ok } from "@/lib/api";
import {
  createSession,
  hashPassword,
  isValidPassword,
  isValidUsername,
  normaliseUsername,
  PASSWORD_RULES,
  USERNAME_RULES,
} from "@/lib/auth";
import { isDialable } from "@/lib/voice/vobiz";

const registerSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  /** Optional at registration; reminder calls simply stay off without it. */
  phone: z.string().trim().max(20).optional().default(""),
  remindersEnabled: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  try {
    const body = registerSchema.parse(await req.json());
    const username = normaliseUsername(body.username);

    if (!isValidUsername(username)) return fail(`Username must be ${USERNAME_RULES}`, 422);
    if (!isValidPassword(body.password)) return fail(`Password must be ${PASSWORD_RULES}`, 422);
    if (body.phone && !isDialable(body.phone)) {
      return fail(
        "That mobile number does not look dialable. Use +91XXXXXXXXXX or a 10-digit Indian mobile.",
        422,
      );
    }

    const taken = await prisma.user.findUnique({ where: { username } });
    if (taken) return fail("That username is already taken", 409);

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash: await hashPassword(body.password),
        name: body.name,
        phone: body.phone || null,
        // Calls cannot be on without a number to dial.
        remindersEnabled: Boolean(body.phone) && body.remindersEnabled,
        profileComplete: false,
      },
    });

    await createSession(user.id, req.headers.get("user-agent"));

    return ok(
      {
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          phone: user.phone,
          remindersEnabled: user.remindersEnabled,
          profileComplete: user.profileComplete,
        },
        // The wellness profile is still needed before a plan can be built.
        next: "/onboarding",
      },
      201,
    );
  } catch (err) {
    return handleError(err);
  }
}
