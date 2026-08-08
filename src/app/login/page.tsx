import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.profileComplete ? "/today" : "/onboarding");

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1.5 text-sm text-muted">
        Sign in to pick up today&apos;s plan where you left it.
      </p>
      <div className="mt-6">
        <AuthForm mode="login" />
      </div>
    </div>
  );
}
