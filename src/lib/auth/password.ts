import bcrypt from "bcryptjs";

export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{9,}$/;
export const PASSWORD_RULE_MESSAGE =
  "Use more than 8 characters, with at least one uppercase letter, one lowercase letter and one special character.";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
