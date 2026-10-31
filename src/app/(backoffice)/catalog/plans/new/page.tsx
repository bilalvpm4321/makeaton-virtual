import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { createPlan } from "@/server/actions/catalog/plans";
import { ActionForm } from "../../_components/action-form";
import { PlanFields } from "../_components/plan-fields";

export default async function NewPlanPage() {
  const user = await requireUser();
  if (!can(user, "catalog.manage")) redirect("/catalog/plans");

  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <>
      <PageHeader title="New plan" description="Define the price, billing period and rules for a recurring offer." />
      <ActionForm action={createPlan} submitLabel="Create plan" cancelHref="/catalog/plans">
        <PlanFields products={products} />
      </ActionForm>
    </>
  );
}
