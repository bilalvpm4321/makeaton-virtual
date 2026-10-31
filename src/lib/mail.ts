import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";

/**
 * Always records the mail in EmailLog (shown at /outbox). Also sends via SMTP when SMTP_HOST is set.
 * Never throws: failures are logged to the console.
 */
export async function sendMail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  try {
    await prisma.emailLog.create({ data: { to, subject, html } });
  } catch (err) {
    console.error("sendMail: failed to write EmailLog", err);
  }

  if (process.env.SMTP_HOST) {
    try {
      const port = Number(process.env.SMTP_PORT ?? 587);
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
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
      });
    } catch (err) {
      console.error("sendMail: SMTP send failed", err);
    }
  }
}
