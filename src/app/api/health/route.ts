import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { envStatus } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DB_TIMEOUT_MS = 5000;

/** Liveness and readiness probe. Returns 200 when the database answers, 503 when it does not. Never exposes secrets. */
export async function GET() {
  const started = Date.now();
  let db: "up" | "down" = "down";
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("database check timed out")), DB_TIMEOUT_MS);
      }),
    ]);
    db = "up";
  } catch (err) {
    console.error("health: database check failed", err);
  } finally {
    clearTimeout(timer);
  }

  const ok = db === "up";
  return NextResponse.json(
    {
      ok,
      db,
      latencyMs: Date.now() - started,
      config: envStatus(),
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      time: new Date().toISOString(),
    },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
