"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Mode = "login" | "register";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const isRegister = mode === "register";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [callsOn, setCallsOn] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (isRegister && password !== confirm) {
      setError("The two passwords do not match");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isRegister
            ? { username, password, name, phone, remindersEnabled: Boolean(phone) && callsOn }
            : { username, password },
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        setBusy(false);
        return;
      }
      router.push(data.next ?? "/today");
      router.refresh();
    } catch {
      setError("Network error — is the dev server still running?");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <div>
        <label className="label" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          required
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          className="input"
          placeholder="aarav.patel"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        {isRegister && (
          <p className="mt-1.5 text-xs text-muted">
            3–24 characters: letters, numbers, dot, underscore or hyphen.
          </p>
        )}
      </div>

      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <div className="flex gap-2">
          <input
            id="password"
            required
            type={showPassword ? "text" : "password"}
            autoComplete={isRegister ? "new-password" : "current-password"}
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            className="btn-ghost shrink-0"
            onClick={() => setShowPassword((v) => !v)}
            aria-pressed={showPassword}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        {isRegister && <p className="mt-1.5 text-xs text-muted">At least 8 characters.</p>}
      </div>

      {isRegister && (
        <>
          <div>
            <label className="label" htmlFor="confirm">
              Confirm password
            </label>
            <input
              id="confirm"
              required
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              className="input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="name">
              What should the coach call you?
            </label>
            <input
              id="name"
              required
              autoComplete="name"
              className="input"
              placeholder="Aarav"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="phone">
              Mobile number{" "}
              <span className="font-normal text-muted">— for reminder calls</span>
            </label>
            <input
              id="phone"
              inputMode="tel"
              autoComplete="tel"
              className="input"
              placeholder="+919824100246"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              WellPath calls this number in Gujarati at your meal, water and movement
              times. Optional — you can add it later, and turn calls off any time.
            </p>

            <label
              className={`mt-2.5 flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition ${
                phone ? "border-line bg-surface" : "border-line bg-background opacity-60"
              }`}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[var(--brand)]"
                checked={Boolean(phone) && callsOn}
                disabled={!phone}
                onChange={(e) => setCallsOn(e.target.checked)}
              />
              <span className="text-sm leading-relaxed">
                <span className="font-medium">Call me with my reminders</span>
                <span className="block text-xs text-muted">
                  Two-second pause after you pick up, the reminder in Gujarati, then it
                  hangs up. Nothing to press.
                </span>
              </span>
            </label>
          </div>
        </>
      )}

      {error && (
        <p className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
        {busy
          ? isRegister
            ? "Creating your account…"
            : "Signing in…"
          : isRegister
            ? "Create account"
            : "Sign in"}
      </button>

      <p className="text-center text-sm text-muted">
        {isRegister ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-brand hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/register" className="font-semibold text-brand hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
