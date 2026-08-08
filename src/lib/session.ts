import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE = "wellpath_uid";

/**
 * Single-user demo session: the profile id lives in a cookie. There is no auth
 * layer here on purpose — this is a wellness demo, not an account system.
 */
export async function getSessionUserId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

export async function setSessionUserId(userId: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Resolves the cookie to a real row, falling back to the only profile if one exists. */
export async function getCurrentUser() {
  const id = await getSessionUserId();
  if (id) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (user) return user;
  }
  // Cookie missing or stale (e.g. the db was reset) — fall back to the single
  // existing profile so a demo never dead-ends on a lost cookie.
  const count = await prisma.user.count();
  if (count === 1) return prisma.user.findFirst();
  return null;
}
