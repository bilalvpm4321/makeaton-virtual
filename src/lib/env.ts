// Server-only: import from route handlers, server components and server actions. Never from a client component.
import { z } from "zod";

// Blank values (for example SMTP_HOST="" in .env.example) count as unset.
const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalString = z.preprocess(blankToUndefined, z.string().optional());
const optionalUrl = z.preprocess(
  blankToUndefined,
  z.url({ error: "must be a valid URL, for example https://brightloop.example.com" }).optional(),
);

const envSchema = z.object({
  DATABASE_URL: z.preprocess(blankToUndefined, z.string({ error: "required" })),
  DATABASE_URL_UNPOOLED: optionalString,
  SESSION_SECRET: optionalString,
  APP_URL: optionalUrl,
  CRON_SECRET: optionalString,
  RESEND_API_KEY: optionalString,
  MAIL_FROM: optionalString,
  NEXT_PUBLIC_FIREBASE_API_KEY: optionalString,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: optionalString,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: optionalString,
  NEXT_PUBLIC_FIREBASE_APP_ID: optionalString,
  ADMIN_EMAIL: optionalString,
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** Validated environment, parsed once per server instance. Throws one error that lists every invalid variable. */
export function getEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join("\n")}`);
  }

  cached = parsed.data;
  return cached;
}

const isSet = (value: string | undefined) => Boolean(value && value.trim());

/**
 * Booleans only, safe to expose on /api/health. Never throws and never returns a value.
 * Email and Google sign-in are "configured" when every variable they need is present.
 */
export function envStatus(): {
  database: boolean;
  sessionSecret: boolean;
  appUrl: boolean;
  cron: boolean;
  email: boolean;
  google: boolean;
} {
  const env = process.env;
  return {
    database: isSet(env.DATABASE_URL),
    sessionSecret: (env.SESSION_SECRET ?? "").length >= 32,
    appUrl: z.url().safeParse(env.APP_URL).success,
    cron: isSet(env.CRON_SECRET),
    email: isSet(env.RESEND_API_KEY) && isSet(env.MAIL_FROM),
    google: isSet(env.NEXT_PUBLIC_FIREBASE_API_KEY) && isSet(env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  };
}
