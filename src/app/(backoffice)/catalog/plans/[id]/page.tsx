import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { updatePlan } from "@/server/actions/catalog/plans";
import { ActionForm } from "../../_components/action-form";
import { PlanFields } from "../_components/plan-fields";

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const canManage = can(user, "catalog.manage");

  const plan = await prisma.plan.findUnique({ where: { id } });
  if (!plan) notFound();

  // Keep the current main product selectable even if it has since been deactivated.
  const products = await prisma.product.findMany({
    where: {
      OR: [{ isActive: true }, ...(plan.productId ? [{ id: plan.productId }] : [])],
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <>
      <PageHeader
        title={plan.name}
        description={
          <span className="inline-flex items-center gap-2">
            {plan.isActive ? "Active plan" : "Inactive plan"}
            <Badge variant={plan.isActive ? "success" : "muted"}>{plan.isActive ? "Active" : "Inactive"}</Badge>
          </span>
        }
        actions={canManage ? undefined : <Badge variant="muted">Read only</Badge>}
      />

      <ActionForm
        action={updatePlan.bind(null, plan.id)}
        readOnly={!canManage}
        submitLabel="Save changes"
        cancelHref="/catalog/plans"
      >
        <PlanFields plan={plan} products={products} />
      </ActionForm>
    </>
  );
}
