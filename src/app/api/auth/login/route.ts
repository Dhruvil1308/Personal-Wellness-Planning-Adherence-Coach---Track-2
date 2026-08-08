import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, handleError, ok } from "@/lib/api";
import {
  checkLoginThrottle,
  clearLoginAttempts,
  createSession,
  normaliseUsername,
  pruneExpiredSessions,
  recordFailedLogin,
  verifyPassword,
} from "@/lib/auth";

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = loginSchema.parse(await req.json());
    const username = normaliseUsername(body.username);

    const throttle = checkLoginThrottle(username);
    if (!throttle.allowed) {
      return fail(
        `Too many failed attempts. Try again in about ${throttle.retryInMin} minute${
          throttle.retryInMin === 1 ? "" : "s"
        }.`,
        429,
      );
    }

    const user = await prisma.user.findUnique({ where: { username } });

    // The same message either way, so this cannot be used to enumerate accounts.
    const invalid = () => {
      recordFailedLogin(username);
      return fail("Wrong username or password", 401);
    };

    if (!user) {
      // Still spend the hashing time so a missing user is not faster to detect.
      await verifyPassword(body.password, "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA");
      return invalid();
    }

    if (!(await verifyPassword(body.password, user.passwordHash))) return invalid();

    clearLoginAttempts(username);
    await pruneExpiredSessions();
    await createSession(user.id, req.headers.get("user-agent"));

    return ok({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        profileComplete: user.profileComplete,
      },
      next: user.profileComplete ? "/today" : "/onboarding",
    });
  } catch (err) {
    return handleError(err);
  }
}
