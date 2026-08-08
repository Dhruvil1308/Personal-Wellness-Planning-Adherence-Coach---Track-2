"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/today", label: "Today" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/history", label: "History" },
  { href: "/onboarding", label: "Profile" },
];

export type NavUser = { username: string; name: string } | null;

/**
 * A rising path with a marker at its crest — drawn, not a lettered badge, so
 * the header reads as a product rather than a placeholder.
 */
function Logo() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 26 26"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M3 19.5c3.2 0 4.6-4.2 6.4-8.2C10.8 8.2 12.1 5.5 14.4 5.5c2.6 0 3.6 3.1 4.2 6"
        stroke="var(--brand)"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <circle cx="19.8" cy="14.4" r="2.6" fill="var(--brand)" />
      <path d="M3.2 22.4h19.6" stroke="var(--line)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function NavBar({ user }: { user: NavUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
        <Link
          href={user ? "/today" : "/"}
          className="flex items-center gap-2 text-foreground"
        >
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight">WellPath</span>
        </Link>

        {user ? (
          <>
            <nav className="ml-auto flex items-center gap-1">
              {LINKS.map((l) => {
                const active = pathname === l.href;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      active
                        ? "bg-brand-soft text-brand-strong"
                        : "text-muted hover:bg-brand-soft/60 hover:text-foreground"
                    }`}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2 border-l border-line pl-3">
              <span
                aria-hidden
                className="grid h-7 w-7 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand-strong"
              >
                {user.name.trim().charAt(0).toUpperCase() || "?"}
              </span>
              <span className="hidden text-sm font-medium sm:inline">{user.name}</span>
              <button
                type="button"
                onClick={logout}
                disabled={busy}
                className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted transition hover:bg-danger-soft hover:text-danger disabled:opacity-50"
              >
                {busy ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </>
        ) : (
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-brand-soft/60 hover:text-foreground"
            >
              Sign in
            </Link>
            <Link href="/register" className="btn-primary py-2">
              Create account
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
