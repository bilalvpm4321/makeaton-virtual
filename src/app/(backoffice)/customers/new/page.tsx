import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerForm } from "../_components/customer-form";

export default function NewCustomerPage() {
  return (
    <>
      <div className="mb-1.5 flex items-center gap-1 text-xs text-neutral-500">
        <Link href="/customers" className="hover:text-neutral-900 hover:underline">
          Customers
        </Link>
        <span>›</span>
        <span className="text-neutral-900">New</span>
      </div>
      <PageHeader title="New customer" description="Contact details used on subscriptions and invoices." />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Contact details</CardTitle>
          <CardDescription>The email must be unique. Phone and tax ID are optional.</CardDescription>
        </CardHeader>
        <CardContent>
          <CustomerForm />
        </CardContent>
      </Card>
    </>
  );
}
