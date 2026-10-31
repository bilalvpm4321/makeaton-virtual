import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { updateProduct } from "@/server/actions/catalog/products";
import { ActionForm } from "../../_components/action-form";
import { ProductFields } from "../_components/product-fields";
import { VariantsCard } from "../_components/variants-card";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const canManage = can(user, "catalog.manage");

  const product = await prisma.product.findUnique({
    where: { id },
    include: { variants: { orderBy: [{ attribute: "asc" }, { value: "asc" }] } },
  });
  if (!product) notFound();

  // Keep the currently assigned tax selectable even if it has been deactivated since.
  const taxes = await prisma.tax.findMany({
    where: {
      OR: [{ isActive: true }, ...(product.defaultTaxId ? [{ id: product.defaultTaxId }] : [])],
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, rateBps: true },
  });

  return (
    <>
      <PageHeader
        title={product.name}
        description={
          <span className="inline-flex items-center gap-2">
            {product.type === "GOODS" ? "Goods" : "Service"}
            <Badge variant={product.isActive ? "success" : "muted"}>{product.isActive ? "Active" : "Inactive"}</Badge>
          </span>
        }
        actions={canManage ? undefined : <Badge variant="muted">Read only</Badge>}
      />

      <ActionForm
        action={updateProduct.bind(null, product.id)}
        readOnly={!canManage}
        submitLabel="Save changes"
        cancelHref="/catalog/products"
      >
        <ProductFields product={product} taxes={taxes} />
      </ActionForm>

      <div className="mt-6">
        <VariantsCard productId={product.id} variants={product.variants} canManage={canManage} />
      </div>
    </>
  );
}
