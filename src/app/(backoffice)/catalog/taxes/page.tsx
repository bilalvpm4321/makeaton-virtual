import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { formatBps } from "@/lib/money";
import { getParam } from "@/lib/pagination";
import { can } from "@/lib/rbac";
import { CheckField, Field } from "../_components/field";
import { ActionForm } from "../_components/action-form";
import { createTax, deleteTax, updateTax } from "@/server/actions/catalog/taxes";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TaxesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const user = await requireUser();
  const canManage = can(user, "catalog.manage");
  const editId = getParam(sp, "edit");

  const taxes = await prisma.tax.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { products: true, subscriptionLines: true, templateLines: true } },
    },
  });
  const editing = canManage && editId ? taxes.find((t) => t.id === editId) : undefined;

  return (
    <>
      <PageHeader
        title="Taxes"
        description="Applied to product and subscription lines. Invoices keep the rate they were issued with."
        actions={canManage ? undefined : <Badge variant="muted">Read only</Badge>}
      />

      {taxes.length === 0 ? (
        <EmptyState title="No taxes yet" description="Add a tax rate, then set it as the default on products." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead>In use</TableHead>
              <TableHead>Status</TableHead>
              {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {taxes.map((t) => {
              const used = t._count.products + t._count.subscriptionLines + t._count.templateLines;
              return (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-right">{formatBps(t.rateBps)}</TableCell>
                  <TableCell className="text-neutral-500">
                    {used === 0 ? "Not used" : `${t._count.products} products · ${t._count.subscriptionLines + t._count.templateLines} lines`}
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.isActive ? "success" : "muted"}>{t.isActive ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/catalog/taxes?edit=${t.id}`}
                          className="rounded-md px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
                        >
                          Edit
                        </Link>
                        <ActionForm
                          compact
                          action={deleteTax}
                          submitLabel="Delete"
                          submitVariant="ghost"
                          submitSize="sm"
                          submitClassName="text-red-600 hover:bg-red-50 hover:text-red-700"
                          className="inline-flex"
                        >
                          <input type="hidden" name="id" value={t.id} />
                        </ActionForm>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {canManage ? (
        <div className="mt-6 max-w-2xl">
          {editing ? (
            <ActionForm
              key={editing.id}
              action={updateTax.bind(null, editing.id)}
              submitLabel="Save tax"
              cancelHref="/catalog/taxes"
            >
              <TaxFields
                title="Edit tax"
                description="Changing the rate does not change invoices that were already issued."
                tax={{ name: editing.name, rateBps: editing.rateBps, isActive: editing.isActive }}
              />
            </ActionForm>
          ) : (
            <ActionForm action={createTax} resetOnSuccess submitLabel="Add tax">
              <TaxFields title="New tax" description="Rates are entered as a percentage, e.g. 18 for 18%." />
            </ActionForm>
          )}
        </div>
      ) : null}
    </>
  );
}

function TaxFields({
  title,
  description,
  tax,
}: {
  title: string;
  description: string;
  tax?: { name: string; rateBps: number; isActive: boolean };
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="tax-name">
          <Input id="tax-name" name="name" required maxLength={80} placeholder="e.g. GST 18%" defaultValue={tax?.name} />
        </Field>
        <Field label="Rate (%)" htmlFor="tax-rate">
          <Input
            id="tax-rate"
            name="rate"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            max="100"
            required
            className="text-right"
            defaultValue={tax ? String(tax.rateBps / 100) : ""}
          />
        </Field>
        <CheckField
          name="isActive"
          label="Active"
          hint="Inactive taxes cannot be picked for new products or lines."
          defaultChecked={tax?.isActive ?? true}
          className="sm:col-span-2"
        />
      </CardContent>
    </Card>
  );
}
