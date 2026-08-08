import { handleError, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return ok({ user: null });

    return ok({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        phone: user.phone,
        remindersEnabled: user.remindersEnabled,
        profileComplete: user.profileComplete,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
