import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";

export type MailProvider = "resend" | "smtp" | "log";

export type MailInput = { to: string; subject: string; html: string; text?: string };

const RESEND_URL = "https://api.resend.com/emails";
const RESEND_TIMEOUT_MS = 10_000;

/**
 * Records the mail in EmailLog (shown at /outbox), then delivers it.
 * Provider order: Resend when RESEND_API_KEY is set, else SMTP when SMTP_HOST is set, else log only.
 * Never throws: failures are logged to the console and reported as `delivered: false`.
 */
export async function sendMail(input: MailInput): Promise<{ delivered: boolean; provider: MailProvider }> {
  await recordInOutbox(input);

  if (process.env.RESEND_API_KEY) {
    const delivered = await sendViaResend(process.env.RESEND_API_KEY, input);
    return { delivered, provider: "resend" };
  }
  if (process.env.SMTP_HOST) {
    const delivered = await sendViaSmtp(process.env.SMTP_HOST, input);
    return { delivered, provider: "smtp" };
  }
  return { delivered: false, provider: "log" };
}

async function recordInOutbox({ to, subject, html }: MailInput): Promise<void> {
  try {
    await prisma.emailLog.create({ data: { to, subject, html } });
  } catch (err) {
    console.error("sendMail: failed to write EmailLog", err);
  }
}

async function sendViaResend(apiKey: string, { to, subject, html, text }: MailInput): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS);
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || "Brightloop <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
        text,
        ...(process.env.MAIL_REPLY_TO ? { reply_to: process.env.MAIL_REPLY_TO } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 500);
      console.error(`sendMail: Resend responded ${res.status}: ${detail}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("sendMail: Resend request failed", err);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function sendViaSmtp(host: string, { to, subject, html, text }: MailInput): Promise<boolean> {
  try {
    const port = Number(process.env.SMTP_PORT ?? 587);
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
        : undefined,
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "Brightloop <billing@brightloop.test>",
      to,
      subject,
      html,
      text,
      replyTo: process.env.MAIL_REPLY_TO || undefined,
    });
    return true;
  } catch (err) {
    console.error("sendMail: SMTP send failed", err);
    return false;
  }
}
