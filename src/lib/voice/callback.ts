/**
 * Vobiz posts callbacks as `application/x-www-form-urlencoded`, but some
 * deployments send JSON. Read either without caring which.
 */
export async function readCallbackParams(req: Request): Promise<Record<string, string>> {
  const contentType = req.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const json = (await req.json()) as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(json).map(([k, v]) => [k, v == null ? "" : String(v)]),
      );
    }
    const form = await req.formData();
    return Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  } catch {
    // Fall back to the query string — the callback still has to be acknowledged.
    return Object.fromEntries(new URL(req.url).searchParams.entries());
  }
}

/** Vobiz uses TitleCase keys (CallUUID, CallStatus); be tolerant of either case. */
export function pick(params: Record<string, string>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const hit = Object.keys(params).find((k) => k.toLowerCase() === key.toLowerCase());
    if (hit && params[hit] !== "") return params[hit];
  }
  return undefined;
}
