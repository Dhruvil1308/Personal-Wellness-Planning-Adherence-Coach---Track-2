/**
 * Session access for pages and route handlers.
 *
 * This used to be a cookie holding a bare user id, with a fallback to "the only
 * profile in the database" when the cookie was missing. Both are gone: the
 * cookie is now an opaque session token (see src/lib/auth.ts) and a missing or
 * unknown token resolves to `null`, never to somebody else's account.
 */
export { getCurrentUser, SESSION_COOKIE } from "@/lib/auth";

import { getCurrentUser } from "@/lib/auth";
import type { User } from "@/generated/prisma/client";

export class UnauthenticatedError extends Error {
  constructor() {
    super("Sign in to continue");
    this.name = "UnauthenticatedError";
  }
}

/** For route handlers that must have a user; throws if there is none. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  return user;
}

export type PublicUser = Omit<User, "passwordHash">;

/**
 * Strips the credential fields before a user row crosses the wire. Every
 * response that includes a user must go through this — a plain `ok({ user })`
 * would ship the password hash to the browser.
 */
export function publicUser(user: User): PublicUser {
  const rest: Partial<User> = { ...user };
  delete rest.passwordHash;
  return rest as PublicUser;
}
