import type { QuotationTemplate } from "@prisma/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "../../_components/field";

export function TemplateFields({
  template,
  plans,
  paymentTerms,
}: {
  template?: Pick<QuotationTemplate, "name" | "validityDays" | "planId" | "paymentTermId" | "notes">;
  plans: { id: string; name: string }[];
  paymentTerms: { id: string; name: string }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Template details</CardTitle>
        <CardDescription>Quotes created from this template are valid for the number of days below.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" className="sm:col-span-2">
          <Input id="name" name="name" required maxLength={120} defaultValue={template?.name} />
        </Field>
        <Field label="Plan" htmlFor="planId">
          <Select id="planId" name="planId" required defaultValue={template?.planId ?? ""}>
            <option value="" disabled>
              Choose a plan
            </option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Validity (days)" htmlFor="validityDays">
          <Input
            id="validityDays"
            name="validityDays"
            type="number"
            min="1"
            step="1"
            required
            className="text-right"
            defaultValue={template?.validityDays ?? 30}
          />
        </Field>
        <Field label="Payment term" htmlFor="paymentTermId">
          <Select id="paymentTermId" name="paymentTermId" defaultValue={template?.paymentTermId ?? ""}>
            <option value="">No payment term</option>
            {paymentTerms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
          <Textarea id="notes" name="notes" rows={3} defaultValue={template?.notes ?? ""} />
        </Field>
      </CardContent>
    </Card>
  );
}
