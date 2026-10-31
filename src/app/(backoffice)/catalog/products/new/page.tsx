import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { createProduct } from "@/server/actions/catalog/products";
import { ActionForm } from "../../_components/action-form";
import { ProductFields } from "../_components/product-fields";

export default async function NewProductPage() {
  const user = await requireUser();
  if (!can(user, "catalog.manage")) redirect("/catalog/products");

  const taxes = await prisma.tax.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, rateBps: true },
  });

  return (
    <>
      <PageHeader
        title="New product"
        description="Products can be used in plans, subscriptions and quotation templates."
      />
      <ActionForm action={createProduct} submitLabel="Create product" cancelHref="/catalog/products">
        <ProductFields taxes={taxes} />
      </ActionForm>
    </>
  );
}
