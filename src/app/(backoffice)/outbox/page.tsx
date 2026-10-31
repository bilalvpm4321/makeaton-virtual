import { format } from "date-fns";
import { ChevronDown, Mail } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { CopyButton } from "./copy-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Outbox · Brightloop" };

function emailKind(subject: string): { label: string; variant: BadgeVariant } {
  const s = subject.toLowerCase();
  if (s.includes("reset")) return { label: "Reset", variant: "warning" };
  if (s.includes("invoice")) return { label: "Invoice", variant: "info" };
  if (s.includes("quot")) return { label: "Quote", variant: "default" };
  return { label: "Email", variant: "muted" };
}

/** Every http(s) URL in the stored HTML, so the reset link can be copied without opening the mail. */
function extractLinks(html: string): string[] {
  const matches = html.match(/https?:\/\/[^\s"'<>]+/g) ?? [];
  return [...new Set(matches.map((m) => m.replace(/&amp;/g, "&")))];
}

/**
 * Wraps stored email HTML for the preview frame. Links open in a new tab (base target). The frame has no
 * scripts and no same-origin access, so the mail content cannot touch the app.
 */
function frameDocument(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{margin:0;padding:20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#16151d}a{color:#4a3be0}</style></head><body>${html}</body></html>`;
}

export default async function OutboxPage() {
  await requireRole("ADMIN");

  const emails = await prisma.emailLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, to: true, subject: true, html: true, createdAt: true },
  });

  return (
    <>
      <PageHeader
        title="Outbox"
        description="Every email the app sends, including password reset links."
      />

      {emails.length === 0 ? (
        <Card>
          <EmptyState
            icon={Mail}
            title="No emails yet"
            description="Password resets and invoice emails will appear here."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {emails.map((email) => {
            const kind = emailKind(email.subject);
            const links = extractLinks(email.html);
            return (
              <details
                key={email.id}
                className="group rounded-xl border border-border bg-card shadow-card open:shadow-pop"
              >
                <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-3.5 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <Badge variant={kind.variant} className="shrink-0">
                        {kind.label}
                      </Badge>
                      <span className="truncate text-sm font-medium">{email.subject}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">To {email.to}</p>
                  </div>
                  <time
                    dateTime={email.createdAt.toISOString()}
                    className="num shrink-0 text-[11px] text-muted-foreground"
                  >
                    {format(email.createdAt, "d MMM yyyy, HH:mm")}
                  </time>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>

                <div className="space-y-4 border-t border-border p-5">
                  {links.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Links in this email</p>
                      {links.map((link) => (
                        <div key={link} className="flex items-center gap-3 rounded-lg bg-subtle p-3">
                          <span className="num min-w-0 flex-1 break-all text-xs">{link}</span>
                          <CopyButton text={link} />
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="overflow-hidden rounded-lg border border-border bg-white">
                    <iframe
                      title={`Email: ${email.subject}`}
                      srcDoc={frameDocument(email.html)}
                      sandbox="allow-popups allow-popups-to-escape-sandbox"
                      className="block h-80 w-full"
                    />
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </>
  );
}
