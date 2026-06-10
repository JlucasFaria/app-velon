import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { getOrder, type OrderDetail } from "@/api/orders";
import { generateReceipt, getReceipt, type Receipt } from "@/api/receipts";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { StatusChangeDialog } from "@/components/orders/StatusChangeDialog";
import { StatusTimeline } from "@/components/orders/StatusTimeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Receipts can only be issued once work has progressed past the initial state.
const RECEIPT_BLOCKED_STATUSES = ["PENDING", "CANCELLED"];

function formatCurrency(value: string) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    getOrder(Number(id))
      .then((data) => {
        setOrder(data);
        setError(null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load order");
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    // A 404 here just means no receipt has been issued yet.
    getReceipt(Number(id))
      .then(setReceipt)
      .catch(() => setReceipt(null));
  }, [id]);

  async function handleGenerateReceipt() {
    if (!id) return;
    setGenerating(true);
    try {
      const generated = await generateReceipt(Number(id));
      setReceipt(generated);
      navigate(`/orders/${id}/receipt`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to generate receipt",
      );
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {error ?? "Order not found."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/orders">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex flex-1 items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{order.orderNumber}</h1>
            <p className="text-sm text-muted-foreground">
              Created{" "}
              {new Date(order.createdAt).toLocaleDateString("pt-BR")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <OrderStatusBadge status={order.status} />
            <Button variant="outline" onClick={() => setStatusDialogOpen(true)}>
              Change status
            </Button>
            {receipt ? (
              <Button
                onClick={() => navigate(`/orders/${order.id}/receipt`)}
              >
                View Receipt
              </Button>
            ) : (
              <Button
                onClick={handleGenerateReceipt}
                disabled={
                  generating ||
                  RECEIPT_BLOCKED_STATUSES.includes(order.status)
                }
              >
                {generating ? "Generating…" : "Generate Receipt"}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Order info</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Client</p>
              <Link
                to={`/clients/${order.client.id}`}
                className="font-medium text-primary hover:underline"
              >
                {order.client.name}
              </Link>
            </div>
            <div>
              <p className="text-muted-foreground">Value</p>
              <p className="font-medium">{formatCurrency(order.value)}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-muted-foreground">Description</p>
              <p className="font-medium whitespace-pre-wrap">
                {order.description}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status history</CardTitle>
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
