import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { createTemplate } from "@/server/actions/catalog/templates";
import { ActionForm } from "../../_components/action-form";
import { TemplateFields } from "../_components/template-fields";

export default async function NewTemplatePage() {
  const user = await requireUser();
  if (!can(user, "catalog.manage")) redirect("/catalog/templates");

  const [plans, paymentTerms] = await Promise.all([
    prisma.plan.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.paymentTerm.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="New quotation template"
        description="Save the template first, then add product lines on the next screen."
      />
      <ActionForm action={createTemplate} submitLabel="Create template" cancelHref="/catalog/templates">
        <TemplateFields plans={plans} paymentTerms={paymentTerms} />
      </ActionForm>
    </>
  );
}
