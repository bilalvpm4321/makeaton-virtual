import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { updateTemplate } from "@/server/actions/catalog/templates";
import { ActionForm } from "../../_components/action-form";
import { TemplateFields } from "../_components/template-fields";
import { LinesCard } from "../_components/lines-card";

export default async function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const canManage = can(user, "catalog.manage");

  const template = await prisma.quotationTemplate.findUnique({
    where: { id },
    include: {
      plan: { select: { name: true } },
      lines: {
        orderBy: { id: "asc" },
        include: {
          product: { select: { name: true } },
          variant: { select: { attribute: true, value: true } },
          tax: { select: { name: true, rateBps: true } },
        },
      },
    },
  });
  if (!template) notFound();

  const [plans, paymentTerms, products, variants, taxes] = await Promise.all([
    // Keep the current plan selectable even if it has since been deactivated.
    prisma.plan.findMany({
      where: { OR: [{ isActive: true }, { id: template.planId }] },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.paymentTerm.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.productVariant.findMany({
      orderBy: [{ product: { name: "asc" } }, { attribute: "asc" }, { value: "asc" }],
      select: { id: true, attribute: true, value: true, isActive: true, product: { select: { name: true } } },
    }),
    prisma.tax.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, rateBps: true } }),
  ]);

  return (
    <>
      <PageHeader
        title={template.name}
        description={`${template.plan.name} · valid for ${template.validityDays} days`}
        actions={canManage ? undefined : <Badge variant="muted">Read only</Badge>}
      />

      <ActionForm
        action={updateTemplate.bind(null, template.id)}
        readOnly={!canManage}
        submitLabel="Save changes"
        cancelHref="/catalog/templates"
      >
        <TemplateFields template={template} plans={plans} paymentTerms={paymentTerms} />
      </ActionForm>

      <div className="mt-6">
        <LinesCard
          templateId={template.id}
          lines={template.lines}
          products={products}
          variants={variants}
          taxes={taxes}
          canManage={canManage}
        />
      </div>
    </>
  );
}
