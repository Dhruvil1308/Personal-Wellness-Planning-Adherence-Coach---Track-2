import { createHash, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import type { User } from "@/generated/prisma/client";

// promisify() drops the options overload, so wrap it by hand.
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derived) =>
      err ? reject(err) : resolve(derived),
    );
  });
}

export const SESSION_COOKIE = "wellpath_session";
const SESSION_DAYS = 30;

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

/**
 * scrypt with a per-user random salt, stored as `scrypt$N$r$p$salt$hash`.
 * Node ships scrypt, so this needs no dependency and no native build.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password.normalize("NFKC"), salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
  });
  return [
    "scrypt",
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  // Rows backfilled by the auth migration carry a sentinel and can never match.
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, n, r, p, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");

  try {
    const derived = await scryptAsync(password.normalize("NFKC"), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/** Only the hash is persisted, so a database dump does not yield live sessions. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, userAgent?: string | null) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      userAgent: userAgent?.slice(0, 200) ?? null,
    },
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return { token, expiresAt };
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  jar.delete(SESSION_COOKIE);
}

/** Ends every session for a user — used when the account is deleted. */
export async function destroyAllSessions(userId: string) {
  await prisma.session.deleteMany({ where: { userId } });
}

/**
 * Resolves the session cookie to a user.
 *
 * There is deliberately no "fall back to the only profile" behaviour here: with
 * real accounts that would hand one user another user's data.
 */
export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => null);
    return null;
  }

  return session.user;
}

/** Best-effort cleanup of expired rows; cheap enough to run on login. */
export async function pruneExpiredSessions() {
  await prisma.session
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => null);
}

// ---------------------------------------------------------------------------
// Login throttling
// ---------------------------------------------------------------------------

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

const globalForAttempts = globalThis as unknown as {
  __wellpathLoginAttempts?: Map<string, { count: number; first: number }>;
};
const attempts = (globalForAttempts.__wellpathLoginAttempts ??= new Map());

/** In-memory, per-username throttle. Enough for a single-node demo. */
export function checkLoginThrottle(key: string): { allowed: boolean; retryInMin?: number } {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now - entry.first > ATTEMPT_WINDOW_MS) return { allowed: true };
  if (entry.count < MAX_ATTEMPTS) return { allowed: true };

  return {
    allowed: false,
    retryInMin: Math.ceil((ATTEMPT_WINDOW_MS - (now - entry.first)) / 60_000),
  };
}

export function recordFailedLogin(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.first > ATTEMPT_WINDOW_MS) {
    attempts.set(key, { count: 1, first: now });
  } else {
    entry.count++;
  }
}

export function clearLoginAttempts(key: string) {
  attempts.delete(key);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export const USERNAME_RULES = "3–24 characters: letters, numbers, dot, underscore or hyphen";
export const PASSWORD_RULES = "at least 8 characters";

export function normaliseUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsername(raw: string): boolean {
  return /^[a-z0-9._-]{3,24}$/.test(normaliseUsername(raw));
}

export function isValidPassword(raw: string): boolean {
  return typeof raw === "string" && raw.length >= 8 && raw.length <= 200;
}
