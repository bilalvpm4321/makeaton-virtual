import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { createDiscount } from "@/server/actions/catalog/discounts";
import { ActionForm } from "../../_components/action-form";
import { DiscountFields } from "../_components/discount-fields";

export default async function NewDiscountPage() {
  const user = await requireUser();
  if (!can(user, "discounts.manage")) redirect("/catalog/discounts");

  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <>
      <PageHeader
        title="New discount"
        description="Admins create discount rules. Staff apply them to subscriptions."
      />
      <ActionForm action={createDiscount} submitLabel="Create discount" cancelHref="/catalog/discounts">
        <DiscountFields products={products} selectedProductIds={[]} />
      </ActionForm>
    </>
  );
}
