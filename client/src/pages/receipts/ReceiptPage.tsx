import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { getReceipt, type Receipt } from "@/api/receipts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDateTime } from "@/lib/format";

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
        setError(err instanceof Error ? err.message : "Recibo não encontrado");
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-11 w-11 rounded-md" />
          <Skeleton className="h-9 w-28" />
        </div>
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="icon"
          className="min-h-11 min-w-11"
          aria-label="Voltar"
          asChild
        >
          <Link to="/orders">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error ?? "Recibo não encontrado."}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label="Voltar para a ordem"
          asChild
        >
          <Link to={`/orders/${receipt.order.id}`}>
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </Button>
        <Button onClick={() => window.print()} size="sm">
          <Printer className="mr-2 h-4 w-4" strokeWidth={1.75} />
          Imprimir
        </Button>
      </div>

      {/* Receipt document — explicit light colors so it prints cleanly. */}
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-gray-900 shadow-card print:shadow-none">
        <div className="flex items-start justify-between border-b border-gray-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg border-2 border-blue-700 text-lg font-bold text-blue-700">
              V
            </div>
            <div>
              <h1 className="text-2xl font-bold leading-none text-blue-700">Velon</h1>
              <p className="mt-1 text-sm text-gray-500">Recibo de serviço</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">Recibo nº {receipt.receiptNumber}</p>
            <p className="text-gray-500">{formatDateTime(receipt.issuedAt)}</p>
          </div>
        </div>

        <div className="grid gap-4 border-b border-gray-200 py-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-gray-500">Cliente</p>
            <p className="font-medium">{receipt.order.client.name}</p>
          </div>
          <div>
            <p className="text-gray-500">Documento</p>
            <p className="font-medium">{receipt.order.client.document}</p>
          </div>
          <div>
            <p className="text-gray-500">Ordem</p>
            <p className="font-medium">{receipt.order.orderNumber}</p>
          </div>
        </div>

        <div className="border-b border-gray-200 py-4 text-sm">
          <p className="text-gray-500">Descrição do serviço</p>
          <p className="font-medium whitespace-pre-wrap">
            {receipt.order.description}
          </p>
        </div>

        <div className="border-b border-gray-200 py-4 text-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="pb-2 font-medium">Descrição</th>
                <th className="pb-2 font-medium">Cat.</th>
                <th className="pb-2 text-right font-medium">Qtd</th>
                <th className="pb-2 text-right font-medium">Vlr. Unit.</th>
                <th className="pb-2 text-right font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {receipt.order.items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-gray-100 last:border-0"
                >
                  <td className="py-1.5">{item.description}</td>
                  <td className="py-1.5 text-gray-500">
                    {item.category ?? "—"}
                  </td>
                  <td className="py-1.5 text-right">{item.quantity}</td>
                  <td className="py-1.5 text-right">
                    {formatCurrency(item.unitValue)}
                  </td>
                  <td className="py-1.5 text-right font-medium">
                    {formatCurrency(item.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between pt-4">
          <span className="text-base font-semibold">Total</span>
          <span className="text-xl font-bold">
            {formatCurrency(receipt.order.value)}
          </span>
        </div>

        <p className="mt-8 text-center text-xs text-gray-400">
          Obrigado pela preferência!
        </p>
      </div>
    </div>
  );
}
