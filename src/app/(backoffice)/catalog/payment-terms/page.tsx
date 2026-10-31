import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { getParam } from "@/lib/pagination";
import { can } from "@/lib/rbac";
import { ActionForm } from "../_components/action-form";
import { Field } from "../_components/field";
import { createPaymentTerm, updatePaymentTerm } from "@/server/actions/catalog/payment-terms";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PaymentTermsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const user = await requireUser();
  const canManage = can(user, "catalog.manage");
  const editId = getParam(sp, "edit");

  const terms = await prisma.paymentTerm.findMany({
    orderBy: [{ dueDays: "asc" }, { name: "asc" }],
    include: { _count: { select: { subscriptions: true, templates: true } } },
  });
  const editing = canManage && editId ? terms.find((t) => t.id === editId) : undefined;

  return (
    <>
      <PageHeader
        title="Payment terms"
        description="How long customers have to pay an invoice after it is issued."
        actions={canManage ? undefined : <Badge variant="muted">Read only</Badge>}
      />

      {terms.length === 0 ? (
        <EmptyState title="No payment terms yet" description="Add terms such as Immediate or 30 days." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Due after</TableHead>
              <TableHead>In use</TableHead>
              {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {terms.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell className="text-right">{t.dueDays === 0 ? "Immediate" : `${t.dueDays} days`}</TableCell>
                <TableCell className="text-neutral-500">
                  {t._count.subscriptions} subscriptions · {t._count.templates} templates
                </TableCell>
                {canManage ? (
                  <TableCell className="text-right">
                    <Link
                      href={`/catalog/payment-terms?edit=${t.id}`}
                      className="rounded-md px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
                    >
                      Edit
                    </Link>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {canManage ? (
        <div className="mt-6 max-w-2xl">
          {editing ? (
            <ActionForm
              key={editing.id}
              action={updatePaymentTerm.bind(null, editing.id)}
              submitLabel="Save term"
              cancelHref="/catalog/payment-terms"
            >
              <PaymentTermFields
                title="Edit payment term"
                term={{ name: editing.name, dueDays: editing.dueDays }}
              />
            </ActionForm>
          ) : (
            <ActionForm action={createPaymentTerm} resetOnSuccess submitLabel="Add term">
              <PaymentTermFields title="New payment term" />
            </ActionForm>
          )}
        </div>
      ) : null}
    </>
  );
}

function PaymentTermFields({ title, term }: { title: string; term?: { name: string; dueDays: number } }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Due days are counted from the invoice issue date. Use 0 for immediate payment.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="term-name">
          <Input id="term-name" name="name" required maxLength={80} placeholder="e.g. 30 days" defaultValue={term?.name} />
        </Field>
        <Field label="Due days" htmlFor="term-due">
          <Input
            id="term-due"
            name="dueDays"
            type="number"
            min="0"
            max="3650"
            step="1"
            className="text-right"
            defaultValue={term ? term.dueDays : 0}
          />
        </Field>
      </CardContent>
    </Card>
  );
}
