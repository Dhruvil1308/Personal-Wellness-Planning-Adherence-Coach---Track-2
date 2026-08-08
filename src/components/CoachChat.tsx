"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: string; content: string };

const PROMPTS = [
  "I skipped my workout again, what now?",
  "I'm too tired to cook dinner",
  "Give me one thing to do right now",
];

export function CoachChat({ initial }: { initial: Msg[] }) {
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;

    setMessages((m) => [...m, { role: "user", content: message }]);
    setInput("");
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "The coach could not reply");
      setMessages((m) => [...m, { role: "coach", content: data.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The coach could not reply");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="max-h-80 min-h-32 flex-1 space-y-2.5 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="text-sm leading-relaxed text-muted">
            Ask the coach anything about today. It reads your actual check-ins before it
            answers, and it stays inside general wellness.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`animate-fade-up max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
              m.role === "user"
                ? "ml-auto bg-brand text-white"
                : "bg-background text-foreground"
            }`}
          >
            {m.content}
          </div>
        ))}
        {busy && (
          <div className="max-w-[92%] rounded-2xl bg-background px-3.5 py-2.5 text-sm text-muted">
            Reading your check-ins…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {messages.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => send(p)}
              className="chip border border-line bg-surface text-muted hover:bg-brand-soft"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-sm font-medium text-danger">{error}</p>}

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          className="input"
          placeholder="Talk to your coach…"
          value={input}
          maxLength={600}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" className="btn-primary shrink-0" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
