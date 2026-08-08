import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.profileComplete ? "/today" : "/onboarding");

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        Set up a login and your mobile number. Next you&apos;ll fill in the wellness
        profile your plan is built from.
      </p>

      <ol className="mt-5 flex items-center gap-2 text-xs font-semibold">
        <li className="chip bg-brand text-white">1 · Account</li>
        <li className="chip bg-line/70 text-muted">2 · Wellness profile</li>
        <li className="chip bg-line/70 text-muted">3 · Your plan</li>
      </ol>

      <div className="mt-5">
        <AuthForm mode="register" />
      </div>
    </div>
  );
}
