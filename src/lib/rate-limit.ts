import { headers } from "next/headers";
import { prisma } from "@/lib/db";

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

/**
 * Fixed-window limiter stored in Postgres so it holds across serverless instances.
 * Fails open: if the database call errors, the request is allowed (availability over strictness).
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  try {
    const rows = await prisma.$queryRaw<{ count: number; windowStart: Date }[]>`
      INSERT INTO "RateLimit" ("key", "count", "windowStart") VALUES (${key}, 1, now())
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${windowSeconds}::float8)
                       THEN 1 ELSE "RateLimit"."count" + 1 END,
        "windowStart" = CASE WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${windowSeconds}::float8)
                             THEN now() ELSE "RateLimit"."windowStart" END
      RETURNING "count", "windowStart"`;
    const { count, windowStart } = rows[0];
    const retryAfterSeconds = Math.max(0, Math.ceil((windowStart.getTime() + windowSeconds * 1000 - Date.now()) / 1000));
    return { allowed: Number(count) <= limit, retryAfterSeconds };
  } catch (err) {
    console.error("rateLimit failed; allowing request", err);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

/** Best-effort client IP from the proxy headers Vercel sets. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
