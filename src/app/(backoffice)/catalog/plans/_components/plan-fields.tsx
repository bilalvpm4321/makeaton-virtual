import type { Plan } from "@prisma/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PERIOD_LABELS, formatDateInput } from "@/lib/dates";
import { fromMinor } from "@/lib/money";
import { CheckField, Field } from "../../_components/field";

type ProductOption = { id: string; name: string };

export function PlanFields({
  plan,
  products,
}: {
  plan?: Pick<
    Plan,
    | "name"
    | "description"
    | "productId"
    | "price"
    | "billingPeriod"
    | "minQuantity"
    | "availableFrom"
    | "availableUntil"
    | "termLength"
    | "autoClose"
    | "closable"
    | "pausable"
    | "renewable"
    | "isPublic"
    | "isActive"
  >;
  products: ProductOption[];
}) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Plan details</CardTitle>
          <CardDescription>The price applies per billing period to the main product.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" className="sm:col-span-2">
            <Input id="name" name="name" required maxLength={120} defaultValue={plan?.name} />
          </Field>
          <Field label="Description" htmlFor="description" className="sm:col-span-2">
            <Textarea id="description" name="description" rows={3} defaultValue={plan?.description ?? ""} />
          </Field>
          <Field label="Main product" htmlFor="productId" hint="Optional. The plan price replaces this product's sales price.">
            <Select id="productId" name="productId" defaultValue={plan?.productId ?? ""}>
              <option value="">No main product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Price (₹)" htmlFor="price">
            <Input
              id="price"
              name="price"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              required
              className="text-right"
              defaultValue={plan ? fromMinor(plan.price) : ""}
            />
          </Field>
          <Field label="Billing period" htmlFor="billingPeriod">
            <Select id="billingPeriod" name="billingPeriod" defaultValue={plan?.billingPeriod ?? "MONTHLY"}>
              {(Object.keys(PERIOD_LABELS) as (keyof typeof PERIOD_LABELS)[]).map((key) => (
                <option key={key} value={key}>
                  {PERIOD_LABELS[key]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Minimum quantity" htmlFor="minQuantity">
            <Input
              id="minQuantity"
              name="minQuantity"
              type="number"
              min="1"
              step="1"
              required
              className="text-right"
              defaultValue={plan?.minQuantity ?? 1}
            />
          </Field>
          <Field label="Term length (billing periods)" htmlFor="termLength" hint="Leave blank for an open-ended plan.">
            <Input
              id="termLength"
              name="termLength"
              type="number"
              min="1"
              step="1"
              placeholder="Open-ended"
              className="text-right"
              defaultValue={plan?.termLength ?? ""}
            />
          </Field>
          <Field label="Available from" htmlFor="availableFrom">
            <Input
              id="availableFrom"
              name="availableFrom"
              type="date"
              defaultValue={formatDateInput(plan?.availableFrom ?? null)}
            />
          </Field>
          <Field label="Available until" htmlFor="availableUntil">
            <Input
              id="availableUntil"
              name="availableUntil"
              type="date"
              defaultValue={formatDateInput(plan?.availableUntil ?? null)}
            />
          </Field>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Plan options</CardTitle>
          <CardDescription>Control what happens to subscriptions on this plan.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <CheckField
            name="autoClose"
            label="Auto-close at end of term"
            hint="Closes the subscription when its term ends."
            defaultChecked={plan?.autoClose ?? false}
          />
          <CheckField
            name="closable"
            label="Closable early"
            hint="Subscriptions can be closed before the term ends."
            defaultChecked={plan?.closable ?? true}
          />
          <CheckField
            name="pausable"
            label="Pausable"
            hint="Subscriptions can be paused and resumed."
            defaultChecked={plan?.pausable ?? false}
          />
          <CheckField
            name="renewable"
            label="Renewable"
            hint="Subscriptions can be renewed at the end of a term."
            defaultChecked={plan?.renewable ?? true}
          />
          <CheckField
            name="isPublic"
            label="Public"
            hint="Listed on the landing page and in the customer portal."
            defaultChecked={plan?.isPublic ?? true}
          />
          <CheckField
            name="isActive"
            label="Active"
            hint="Inactive plans cannot be used for new subscriptions."
            defaultChecked={plan?.isActive ?? true}
          />
        </CardContent>
      </Card>
    </>
  );
}
