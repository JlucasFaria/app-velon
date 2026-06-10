import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { getReceipt, type Receipt } from "@/api/receipts";
import { Button } from "@/components/ui/button";

function formatCurrency(value: string) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

export function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getReceipt(Number(id))
      .then((r) => {
        setReceipt(r);
        setError(null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Receipt not found");
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {error ?? "Receipt not found."}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/orders/${receipt.order.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </div>

      {/* Receipt document — explicit light colors so it prints cleanly. */}
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-gray-900">
        <div className="flex items-start justify-between border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-2xl font-bold">Velon</h1>
            <p className="text-sm text-gray-500">Service receipt</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">Receipt #{receipt.receiptNumber}</p>
            <p className="text-gray-500">{formatDateTime(receipt.issuedAt)}</p>
          </div>
        </div>

        <div className="grid gap-4 border-b border-gray-200 py-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-gray-500">Client</p>
            <p className="font-medium">{receipt.order.client.name}</p>
          </div>
          <div>
            <p className="text-gray-500">Document</p>
            <p className="font-medium">{receipt.order.client.document}</p>
          </div>
          <div>
            <p className="text-gray-500">Order</p>
            <p className="font-medium">{receipt.order.orderNumber}</p>
          </div>
        </div>

        <div className="border-b border-gray-200 py-4 text-sm">
          <p className="text-gray-500">Service description</p>
          <p className="font-medium whitespace-pre-wrap">
            {receipt.order.description}
          </p>
        </div>

        <div className="flex items-center justify-between pt-4">
          <span className="text-base font-semibold">Total</span>
          <span className="text-xl font-bold">
            {formatCurrency(receipt.order.value)}
          </span>
        </div>
      </div>
    </div>
  );
}
