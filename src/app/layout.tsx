import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "@/components/NavBar";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "WellPath AI — Personal Wellness Planning & Adherence Coach",
  description:
    "An AI wellness assistant that builds a personalised daily routine, runs check-ins, and adjusts tomorrow's plan from what you actually recorded.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <NavBar user={user ? { username: user.username, name: user.name } : null} />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-5 text-xs leading-relaxed text-muted">
            <strong className="text-foreground">General wellness only.</strong>{" "}
            WellPath does not diagnose conditions, prescribe medication, or replace a
            qualified professional. Talk to a doctor or registered dietitian before
            making significant changes, and seek immediate help for urgent symptoms.
          </div>
        </footer>
      </body>
    </html>
  );
}
