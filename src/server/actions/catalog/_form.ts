import { Prisma } from "@prisma/client";

// Shared parsing helpers for catalog server actions. Not a server-action module (no "use server").

/** Trimmed string value of a form field, "" when missing. */
export function text(fd: FormData, key: string): string {
  const value = fd.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Trimmed string, or null when blank. */
export function optionalText(fd: FormData, key: string): string | null {
  const value = text(fd, key);
  return value === "" ? null : value;
}

/** Numeric field: undefined when blank, NaN when not a number (zod rejects NaN). */
export function num(fd: FormData, key: string): number | undefined {
  const raw = text(fd, key);
  if (raw === "") return undefined;
  return Number(raw.replace(/,/g, ""));
}

/** Checkbox field: true when checked. */
export function checked(fd: FormData, key: string): boolean {
  return fd.get(key) === "on";
}

/** All non-empty string values for a repeated field (checkbox lists). */
export function texts(fd: FormData, key: string): string[] {
  return fd
    .getAll(key)
    .filter((v): v is string => typeof v === "string" && v.trim() !== "")
    .map((v) => v.trim());
}

/** Maps the first zod issue to a top-level action error. */
export function fail(error: { issues: ReadonlyArray<{ message: string }> }): { error: string } {
  return { error: error.issues[0]?.message ?? "Please check the form and try again." };
}

export function isPrismaError(e: unknown, code: string): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === code;
}
