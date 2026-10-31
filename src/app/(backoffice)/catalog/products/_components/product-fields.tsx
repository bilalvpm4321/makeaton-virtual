import type { Product } from "@prisma/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatBps, fromMinor } from "@/lib/money";
import { CheckField, Field } from "../../_components/field";

type TaxOption = { id: string; name: string; rateBps: number };

export function ProductFields({
  product,
  taxes,
}: {
  product?: Pick<Product, "name" | "type" | "salesPrice" | "costPrice" | "notes" | "defaultTaxId" | "isActive">;
  taxes: TaxOption[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Product details</CardTitle>
        <CardDescription>Prices are entered in rupees. Cost price is for internal margin tracking.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" className="sm:col-span-2">
          <Input id="name" name="name" required maxLength={120} defaultValue={product?.name} />
        </Field>
        <Field label="Type" htmlFor="type">
          <Select id="type" name="type" defaultValue={product?.type ?? "SERVICE"}>
            <option value="SERVICE">Service</option>
            <option value="GOODS">Goods</option>
          </Select>
        </Field>
        <Field label="Default tax" htmlFor="defaultTaxId">
          <Select id="defaultTaxId" name="defaultTaxId" defaultValue={product?.defaultTaxId ?? ""}>
            <option value="">No tax</option>
            {taxes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({formatBps(t.rateBps)})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Sales price (₹)" htmlFor="salesPrice">
          <Input
            id="salesPrice"
            name="salesPrice"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            required
            className="text-right"
            defaultValue={product ? fromMinor(product.salesPrice) : ""}
          />
        </Field>
        <Field label="Cost price (₹)" htmlFor="costPrice">
          <Input
            id="costPrice"
            name="costPrice"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            className="text-right"
            defaultValue={product ? fromMinor(product.costPrice) : "0.00"}
          />
        </Field>
        <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
          <Textarea id="notes" name="notes" rows={3} defaultValue={product?.notes ?? ""} />
        </Field>
        <CheckField
          name="isActive"
          label="Active"
          hint="Inactive products stay on existing subscriptions but cannot be added to new ones."
          defaultChecked={product?.isActive ?? true}
          className="sm:col-span-2"
        />
      </CardContent>
    </Card>
  );
}
