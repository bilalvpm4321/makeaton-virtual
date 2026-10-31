import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

export type EmailContent = { subject: string; html: string; text: string };

const PAGE = "#f6f5f2";
const CARD = "#ffffff";
const INK = "#1f1d2b";
const MUTED = "#6b6880";
const RULE = "#e7e5e0";
const BRAND = "#5b4cf0";
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const FOOTER = "Brightloop Software · Subscription billing";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 16px 0;font-family:${FONT};font-size:22px;line-height:28px;font-weight:bold;color:${INK};">${escapeHtml(text)}</h1>`;
}

function paragraph(text: string, color = INK): string {
  return `<p style="margin:0 0 16px 0;font-family:${FONT};font-size:15px;line-height:22px;color:${color};">${escapeHtml(text)}</p>`;
}

function button(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0;"><tr><td bgcolor="${BRAND}" style="border-radius:8px;background-color:${BRAND};"><a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:15px;font-weight:bold;line-height:20px;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a></td></tr></table>`;
}

function fallbackLink(url: string): string {
  return `<p style="margin:0 0 16px 0;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">If the button does not work, copy and paste this link into your browser:<br><a href="${escapeHtml(url)}" style="color:${BRAND};word-break:break-all;">${escapeHtml(url)}</a></p>`;
}

type Detail = { label: string; value: string };

function details(rows: Detail[]): string {
  const cells = rows
    .map(
      (r) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid ${RULE};font-family:${FONT};font-size:14px;line-height:20px;color:${MUTED};">${escapeHtml(r.label)}</td><td align="right" style="padding:8px 0;border-bottom:1px solid ${RULE};font-family:${FONT};font-size:14px;line-height:20px;color:${INK};">${escapeHtml(r.value)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0;">${cells}</table>`;
}

function layout({ title, preheader, content }: { title: string; preheader: string; content: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${PAGE};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${PAGE};">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE};">
<tr>
<td align="center" style="padding:32px 16px;">
<!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 0 16px 0;font-family:${FONT};font-size:18px;line-height:24px;font-weight:bold;color:${INK};">Brightloop</td></tr>
<tr><td style="background-color:${CARD};border-radius:12px;padding:32px;font-family:${FONT};font-size:15px;line-height:22px;color:${INK};">
${content}
</td></tr>
<tr><td align="center" style="padding:20px 8px 0 8px;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">${FOOTER}</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td>
</tr>
</table>
</body>
</html>`;
}

function textBody(parts: string[]): string {
  return [...parts, FOOTER].join("\n\n");
}

function textDetails(rows: Detail[]): string {
  return rows.map((r) => `${r.label}: ${r.value}`).join("\n");
}

export function passwordResetEmail({ name, url }: { name: string; url: string }): EmailContent {
  const subject = "Reset your Brightloop password";
  const intro = `Hi ${name}, we received a request to reset your Brightloop password. Use the button below to choose a new one. The link expires in 1 hour and can only be used once.`;
  const note = "If you did not request this, you can ignore this email. Your password will not change.";

  return {
    subject,
    html: layout({
      title: subject,
      preheader: "Your reset link is valid for one hour",
      content:
        heading("Reset your password") +
        paragraph(intro) +
        button("Reset password", url) +
        fallbackLink(url) +
        paragraph(note, MUTED),
    }),
    text: textBody([
      `Hi ${name},`,
      "We received a request to reset your Brightloop password. Open the link below to choose a new one. The link expires in 1 hour and can only be used once.",
      url,
      note,
    ]),
  };
}

export function welcomeEmail({ name, loginUrl }: { name: string; loginUrl: string }): EmailContent {
  const subject = "Welcome to Brightloop";
  const intro = `Hi ${name}, your account is ready. Sign in to see your quotations, subscriptions and invoices in one place.`;

  return {
    subject,
    html: layout({
      title: subject,
      preheader: "Your Brightloop account is ready",
      content:
        heading("Welcome to Brightloop") +
        paragraph(intro) +
        button("Sign in to Brightloop", loginUrl) +
        fallbackLink(loginUrl),
    }),
    text: textBody([
      `Hi ${name},`,
      "Your Brightloop account is ready. Sign in to see your quotations, subscriptions and invoices in one place.",
      loginUrl,
    ]),
  };
}

export function quotationEmail({
  customerName,
  number,
  planName,
  total,
  validUntil,
  url,
}: {
  customerName: string;
  number: string;
  planName: string;
  total: number;
  validUntil: Date | null;
  url: string;
}): EmailContent {
  const subject = `Quotation ${number} from Brightloop`;
  const intro = `Hi ${customerName}, quotation ${number} for ${planName} is ready for you to review.`;
  const rows: Detail[] = [
    { label: "Quotation", value: number },
    { label: "Plan", value: planName },
    { label: "Recurring total", value: formatMoney(total) },
  ];
  if (validUntil) rows.push({ label: "Valid until", value: formatDate(validUntil) });

  return {
    subject,
    html: layout({
      title: subject,
      preheader: `Quotation ${number} is ready to review`,
      content:
        heading("Your quotation is ready") +
        paragraph(intro) +
        details(rows) +
        button("View and accept quotation", url) +
        fallbackLink(url),
    }),
    text: textBody([`Hi ${customerName},`, intro, textDetails(rows), `View and accept your quotation: ${url}`]),
  };
}

export function invoiceEmail({
  customerName,
  number,
  issueDate,
  dueDate,
  total,
  amountDue,
  url,
}: {
  customerName: string;
  number: string;
  issueDate: Date;
  dueDate: Date;
  total: number;
  amountDue: number;
  url: string;
}): EmailContent {
  const subject = `Invoice ${number} from Brightloop`;
  const intro = `Hi ${customerName}, invoice ${number} is ready.`;
  const amountDueLabel = amountDue > 0 ? formatMoney(amountDue) : "Paid in full";
  const rows: Detail[] = [
    { label: "Issued", value: formatDate(issueDate) },
    { label: "Due", value: formatDate(dueDate) },
    { label: "Total", value: formatMoney(total) },
    { label: "Amount due", value: amountDueLabel },
  ];
  const payNote = "Pay by bank transfer and quote the invoice number.";

  return {
    subject,
    html: layout({
      title: subject,
      preheader: `Invoice ${number}: ${amountDueLabel}`,
      content:
        heading(`Invoice ${number}`) +
        paragraph(intro) +
        details(rows) +
        button("View invoice", url) +
        fallbackLink(url) +
        paragraph(payNote, MUTED),
    }),
    text: textBody([`Hi ${customerName},`, intro, textDetails(rows), `View invoice: ${url}`, payNote]),
  };
}
