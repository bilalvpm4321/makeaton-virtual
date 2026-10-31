import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBps, formatMoney } from "@/lib/money";
import { addTemplateLine, removeTemplateLine } from "@/server/actions/catalog/templates";
import { ActionForm } from "../../_components/action-form";
import { Field } from "../../_components/field";

type LineRow = {
  id: string;
  quantity: number;
  unitPrice: number | null;
  product: { name: string };
  variant: { attribute: string; value: string } | null;
  tax: { name: string; rateBps: number } | null;
};

type VariantOption = {
  id: string;
  attribute: string;
  value: string;
  isActive: boolean;
  product: { name: string };
};

export function LinesCard({
  templateId,
  lines,
  products,
  variants,
  taxes,
  canManage,
}: {
  templateId: string;
  lines: LineRow[];
  products: { id: string; name: string }[];
  variants: VariantOption[];
  taxes: { id: string; name: string; rateBps: number }[];
  canManage: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lines</CardTitle>
        <CardDescription>Products added to a quote created from this template.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {lines.length === 0 ? (
          <p className="text-sm text-neutral-500">No lines yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead>Tax</TableHead>
                {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.product.name}</TableCell>
                  <TableCell className="text-neutral-500">
                    {l.variant ? `${l.variant.attribute}: ${l.variant.value}` : "—"}
                  </TableCell>
                  <TableCell className="text-right">{l.quantity}</TableCell>
                  <TableCell className="text-right">
                    {l.unitPrice === null ? (
                      <Badge variant="secondary">Default</Badge>
                    ) : (
                      formatMoney(l.unitPrice)
                    )}
                  </TableCell>
                  <TableCell className="text-neutral-500">
                    {l.tax ? `${l.tax.name} (${formatBps(l.tax.rateBps)})` : "—"}
                  </TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      <ActionForm
                        compact
                        action={removeTemplateLine}
                        submitLabel="Remove"
                        submitVariant="ghost"
                        submitSize="sm"
                        submitClassName="text-red-600 hover:bg-red-50 hover:text-red-700"
                        className="inline-flex"
                      >
                        <input type="hidden" name="id" value={l.id} />
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
            <p className="mb-4 text-sm font-medium">Add line</p>
            <ActionForm
              action={addTemplateLine.bind(null, templateId)}
              resetOnSuccess
              submitLabel="Add line"
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <Field label="Product" htmlFor="line-product" className="lg:col-span-2">
                  <Select id="line-product" name="productId" required defaultValue="">
                    <option value="" disabled>
                      Choose a product
                    </option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Variant" htmlFor="line-variant" className="lg:col-span-2">
                  <Select id="line-variant" name="variantId" defaultValue="">
                    <option value="">No variant</option>
                    {variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {`${v.product.name} — ${v.attribute}: ${v.value}`}
                        {v.isActive ? "" : " (inactive)"}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Quantity" htmlFor="line-qty">
                  <Input id="line-qty" name="quantity" type="number" min="1" step="1" defaultValue="1" className="text-right" />
                </Field>
                <Field label="Unit price (₹)" htmlFor="line-price" hint="Blank uses the default price.">
                  <Input
                    id="line-price"
                    name="unitPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Default"
                    className="text-right"
                  />
                </Field>
                <Field label="Tax" htmlFor="line-tax">
                  <Select id="line-tax" name="taxId" defaultValue="">
                    <option value="">No tax</option>
                    {taxes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({formatBps(t.rateBps)})
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </ActionForm>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
