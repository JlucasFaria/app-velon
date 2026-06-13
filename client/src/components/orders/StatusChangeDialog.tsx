import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  changeOrderStatus,
  type OrderDetail,
  type OrderStatus,
} from "@/api/orders";
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/order-status";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface StatusChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: number;
  currentStatus: OrderStatus;
  onUpdated: (order: OrderDetail) => void;
}

export function StatusChangeDialog({
  open,
  onOpenChange,
  orderId,
  currentStatus,
  onUpdated,
}: StatusChangeDialogProps) {
  const [status, setStatus] = useState<OrderStatus>(currentStatus);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  // Reset the form to the current status on each open transition (closed→open),
  // adjusting state during render rather than in an effect.
  if (open && !wasOpen) {
    setWasOpen(true);
    setStatus(currentStatus);
    setNote("");
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const updated = await changeOrderStatus(
        orderId,
        status,
        note || undefined,
      );
      toast.success("Status atualizado com sucesso");
      onUpdated(updated);
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Falha ao atualizar o status",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar status</DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-col gap-2">
              <span>Selecione o novo status e, se quiser, registre uma observação.</span>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                Status atual: <OrderStatusBadge status={currentStatus} />
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Novo status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as OrderStatus)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORDER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {ORDER_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Observação (opcional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Motivo da alteração…"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={submitting || status === currentStatus}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Salvando…" : "Confirmar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
