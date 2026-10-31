import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { runBilling } from "@/lib/billing/run";
import { parseDateInput, today } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ date: z.string().optional() });

function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Cron entry point. Requires header `x-cron-secret: $CRON_SECRET`. Optional body `{ "date": "YYYY-MM-DD" }`. */
export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected || !secretMatches(req.headers.get("x-cron-secret"), expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown = {};
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  const parsed = bodySchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  let runDate = today();
  if (parsed.data.date) {
    const d = parseDateInput(parsed.data.date);
    if (!d) return NextResponse.json({ error: "date must be YYYY-MM-DD." }, { status: 400 });
    runDate = d;
  }

  try {
    const run = await runBilling(runDate, "cron");
    return NextResponse.json(run);
  } catch (err) {
    console.error("cron billing failed", err);
    return NextResponse.json({ error: "Billing run failed." }, { status: 500 });
  }
}
