import type { DiscountRule } from "@prisma/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDateInput } from "@/lib/dates";
import { fromMinor } from "@/lib/money";
import { CheckField, Field } from "../../_components/field";

type RuleValues = Pick<
  DiscountRule,
  | "name"
  | "code"
  | "type"
  | "value"
  | "scope"
  | "minPurchase"
  | "minQuantity"
  | "startDate"
  | "endDate"
  | "usageLimit"
  | "usageCount"
  | "isActive"
>;

export function DiscountFields({
  rule,
  products,
  selectedProductIds,
}: {
  rule?: RuleValues;
  products: { id: string; name: string }[];
  selectedProductIds: string[];
}) {
  const valueDefault = rule
    ? rule.type === "PERCENT"
      ? String(rule.value / 100)
      : fromMinor(rule.value)
    : "";

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Discount details</CardTitle>
          <CardDescription>Leave the code blank for a rule that applies automatically.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" className="sm:col-span-2">
            <Input id="name" name="name" required maxLength={120} defaultValue={rule?.name} />
          </Field>
          <Field label="Code" htmlFor="code" hint="Optional. Stored in uppercase, must be unique.">
            <Input
              id="code"
              name="code"
              maxLength={32}
              placeholder="e.g. WELCOME10"
              className="uppercase"
              defaultValue={rule?.code ?? ""}
            />
          </Field>
          <Field label="Type" htmlFor="type">
            <Select id="type" name="type" defaultValue={rule?.type ?? "PERCENT"}>
              <option value="PERCENT">Percentage (%)</option>
              <option value="FIXED">Fixed amount (₹)</option>
            </Select>
          </Field>
          <Field label="Value" htmlFor="value" hint="Enter 10 for 10%, or 500 for ₹500.">
            <Input
              id="value"
              name="value"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              required
              className="text-right"
              defaultValue={valueDefault}
            />
          </Field>
          {rule ? (
            <Field label="Usage" htmlFor="usage-readonly" hint="Counted each time the rule is applied to an invoice.">
              <p id="usage-readonly" className="flex h-9 items-center text-sm">
                Used {rule.usageCount} time{rule.usageCount === 1 ? "" : "s"}
              </p>
            </Field>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Applies to</CardTitle>
          <CardDescription>Whole subscriptions, or only the products you select.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 p-3">
              <input
                type="radio"
                name="scope"
                value="SUBSCRIPTION"
                defaultChecked={!rule || rule.scope === "SUBSCRIPTION"}
                className="mt-0.5 size-4"
              />
              <span className="text-sm font-medium">Whole subscription</span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 p-3">
              <input
                type="radio"
                name="scope"
                value="PRODUCTS"
                defaultChecked={rule?.scope === "PRODUCTS"}
                className="mt-0.5 size-4"
              />
              <span className="text-sm font-medium">Specific products</span>
            </label>
          </div>
          <Field label="Products" htmlFor="productIds" hint="Used only when the scope is Specific products.">
            <div id="productIds" className="grid max-h-72 gap-2 overflow-y-auto rounded-md border border-neutral-200 p-3 sm:grid-cols-2">
              {products.length === 0 ? (
                <p className="text-sm text-neutral-500">No active products.</p>
              ) : (
                products.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="productIds"
                      value={p.id}
                      defaultChecked={selectedProductIds.includes(p.id)}
                      className="size-4 rounded border-neutral-300"
                    />
                    {p.name}
                  </label>
                ))
              )}
            </div>
          </Field>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Conditions and validity</CardTitle>
          <CardDescription>Minimums are checked against the eligible lines of each invoice.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Minimum purchase (₹)" htmlFor="minPurchase">
            <Input
              id="minPurchase"
              name="minPurchase"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className="text-right"
              defaultValue={rule ? fromMinor(rule.minPurchase) : "0.00"}
            />
          </Field>
          <Field label="Minimum quantity" htmlFor="minQuantity">
            <Input
              id="minQuantity"
              name="minQuantity"
              type="number"
              step="1"
              min="0"
              className="text-right"
              defaultValue={rule?.minQuantity ?? 0}
            />
          </Field>
          <Field label="Start date" htmlFor="startDate">
            <Input id="startDate" name="startDate" type="date" defaultValue={formatDateInput(rule?.startDate ?? null)} />
          </Field>
          <Field label="End date" htmlFor="endDate">
            <Input id="endDate" name="endDate" type="date" defaultValue={formatDateInput(rule?.endDate ?? null)} />
          </Field>
          <Field label="Usage limit" htmlFor="usageLimit" hint="Leave blank for unlimited uses.">
            <Input
              id="usageLimit"
              name="usageLimit"
              type="number"
              step="1"
              min="1"
              className="text-right"
              defaultValue={rule?.usageLimit ?? ""}
            />
          </Field>
          <CheckField
            name="isActive"
            label="Active"
            hint="Inactive rules are never applied to new invoices."
            defaultChecked={rule?.isActive ?? true}
          />
        </CardContent>
      </Card>
    </>
  );
}
