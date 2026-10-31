import type { ProductVariant } from "@prisma/client";
import { ActionForm } from "../../_components/action-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { addVariant, removeVariant } from "@/server/actions/catalog/products";
import { Field } from "../../_components/field";
import { signedMoney } from "../../_components/format";

export function VariantsCard({
  productId,
  variants,
  canManage,
}: {
  productId: string;
  variants: ProductVariant[];
  canManage: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Variants</CardTitle>
        <CardDescription>
          Each variant adds its extra price to the product&apos;s sales price, e.g. Brand: Odoo +₹560.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {variants.length === 0 ? (
          <p className="text-sm text-neutral-500">No variants yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Attribute</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="text-right">Extra price</TableHead>
                <TableHead>Status</TableHead>
                {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {variants.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>{v.attribute}</TableCell>
                  <TableCell className="font-medium">{v.value}</TableCell>
                  <TableCell className="text-right">{signedMoney(v.extraPrice)}</TableCell>
                  <TableCell>
                    <Badge variant={v.isActive ? "success" : "muted"}>{v.isActive ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      <ActionForm
                        compact
                        action={removeVariant}
                        submitLabel="Remove"
                        submitVariant="ghost"
                        submitSize="sm"
                        submitClassName="text-red-600 hover:bg-red-50 hover:text-red-700"
                        className="inline-flex"
                      >
                        <input type="hidden" name="id" value={v.id} />
                      </ActionForm>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {canManage ? (
          <div className="border-t border-neutral-200 pt-5">
            <p className="mb-4 text-sm font-medium">Add variant</p>
            <ActionForm
              action={addVariant.bind(null, productId)}
              resetOnSuccess
              submitLabel="Add variant"
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Attribute" htmlFor="variant-attribute">
                  <Input id="variant-attribute" name="attribute" defaultValue="Brand" required maxLength={60} />
                </Field>
                <Field label="Value" htmlFor="variant-value">
                  <Input id="variant-value" name="value" placeholder="e.g. Odoo" required maxLength={120} />
                </Field>
                <Field label="Extra price (₹)" htmlFor="variant-extra" hint="Use a negative amount for a discount.">
                  <Input
                    id="variant-extra"
                    name="extraPrice"
                    type="number"
                    step="0.01"
                    defaultValue="0"
                    className="text-right"
                  />
                </Field>
              </div>
            </ActionForm>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
