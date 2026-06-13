import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  Loader2,
  Receipt as ReceiptIcon,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { getOrder, type OrderDetail } from "@/api/orders";
import { generateReceipt, getReceipt, type Receipt } from "@/api/receipts";
import { downloadOrderPdf } from "@/api/pdf";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { PaymentBadge } from "@/components/orders/PaymentBadge";
import { StatusChangeDialog } from "@/components/orders/StatusChangeDialog";
import { StatusTimeline } from "@/components/orders/StatusTimeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { useAuth } from "@/contexts/auth-context";

// Receipts can only be issued once work has progressed past the initial state.
const RECEIPT_BLOCKED_STATUSES = ["PENDING", "CANCELLED"];

function BackButton() {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="min-h-11 min-w-11 shrink-0"
      aria-label="Voltar para ordens"
      asChild
    >
      <Link to="/orders">
        <ArrowLeft className="h-4 w-4" />
      </Link>
    </Button>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-48 lg:col-span-2" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = user?.role !== "VIEWER";
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getOrder(Number(id))
      .then((data) => {
        if (cancelled) return;
        setOrder(data);
        setError(null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Falha ao carregar a ordem",
        );
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    // A 404 here just means no receipt has been issued yet.
    getReceipt(Number(id))
      .then((r) => {
        if (cancelled) return;
        setReceipt(r);
        setReceiptLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setReceipt(null);
        setReceiptLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleDownloadPdf() {
    if (!id) return;
    setPdfLoading(true);
    try {
      await downloadOrderPdf(Number(id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar o PDF");
    } finally {
      setPdfLoading(false);
    }
  }

  async function handleGenerateReceipt() {
    if (!id) return;
    setGenerating(true);
    try {
      const generated = await generateReceipt(Number(id));
      setReceipt(generated);
      navigate(`/orders/${id}/receipt`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Falha ao gerar o recibo",
      );
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return <DetailSkeleton />;
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <BackButton />
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error ?? "Ordem não encontrada."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <BackButton />
        <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {order.orderNumber}
            </h1>
            <p className="text-sm text-muted-foreground">
              Criada em {formatDate(order.createdAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <PaymentBadge
              status={order.paymentStatus}
              note={order.paymentNote}
            />
            <Button
              variant="outline"
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
            >
              {pdfLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {pdfLoading ? "Gerando…" : "PDF"}
            </Button>
            {canWrite && (
              <Button
                variant="outline"
                onClick={() => setStatusDialogOpen(true)}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Alterar status
              </Button>
            )}
            {receiptLoading ? (
              <Button disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Recibo
              </Button>
            ) : receipt ? (
              // Viewing an issued receipt is allowed for every role.
              <Button onClick={() => navigate(`/orders/${order.id}/receipt`)}>
                <ReceiptIcon className="mr-2 h-4 w-4" />
                Ver recibo
              </Button>
            ) : (
              // Issuing a receipt is a write action — hidden from read-only users.
              canWrite && (
                <Button
                  onClick={handleGenerateReceipt}
                  disabled={
                    generating ||
                    RECEIPT_BLOCKED_STATUSES.includes(order.status)
                  }
                >
                  {generating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ReceiptIcon className="mr-2 h-4 w-4" />
                  )}
                  {generating ? "Gerando…" : "Gerar recibo"}
                </Button>
              )
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Informações da ordem</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground">Cliente</p>
                <Link
                  to={`/clients/${order.client.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {order.client.name}
                </Link>
              </div>
              <div>
                <p className="text-muted-foreground">Descrição</p>
                <p className="font-medium whitespace-pre-wrap">
                  {order.description}
                </p>
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">Itens</p>
              <div className="overflow-x-auto rounded-xl border border-border/70">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">Descrição</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">Categoria</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">Qtd</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">Vlr. Unit.</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item) => (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">{item.description}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {item.category ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right">{item.quantity}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(item.unitValue)}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-muted/40">
                      <td colSpan={4} className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total</td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">{formatCurrency(order.value)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Histórico de status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusTimeline entries={order.statusHistory} />
          </CardContent>
        </Card>
      </div>

      <StatusChangeDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        orderId={order.id}
        currentStatus={order.status}
        onUpdated={setOrder}
      />
    </div>
  );
}
