import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { updateDiscount } from "@/server/actions/catalog/discounts";
import { ActionForm } from "../../_components/action-form";
import { DiscountFields } from "../_components/discount-fields";

export default async function DiscountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const canManage = can(user, "discounts.manage");

  const rule = await prisma.discountRule.findUnique({
    where: { id },
    include: { products: { select: { id: true } } },
  });
  if (!rule) notFound();

  const products = await prisma.product.findMany({
    where: {
      OR: [{ isActive: true }, ...rule.products.map((p) => ({ id: p.id }))],
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <>
      <PageHeader
        title={rule.name}
        description={
          <span className="inline-flex items-center gap-2">
            {rule.code ? <span className="font-mono">{rule.code}</span> : "No code"}
            <Badge variant={rule.isActive ? "success" : "muted"}>{rule.isActive ? "Active" : "Inactive"}</Badge>
          </span>
        }
        actions={canManage ? undefined : <Badge variant="muted">Read only</Badge>}
      />

      <ActionForm
        action={updateDiscount.bind(null, rule.id)}
        readOnly={!canManage}
        submitLabel="Save changes"
        cancelHref="/catalog/discounts"
      >
        <DiscountFields
          rule={rule}
          products={products}
          selectedProductIds={rule.products.map((p) => p.id)}
        />
      </ActionForm>
    </>
  );
}
