import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  updateOrder,
  PAYMENT_STATUS_LABELS,
  type PaymentStatus,
} from "@/api/orders";
import { PaymentBadge } from "@/components/orders/PaymentBadge";
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

const PAYMENT_STATUSES = Object.keys(
  PAYMENT_STATUS_LABELS,
) as PaymentStatus[];

interface PaymentChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: number;
  currentStatus: PaymentStatus;
  currentNote: string | null;
  onUpdated: (paymentStatus: PaymentStatus, paymentNote: string | null) => void;
}

export function PaymentChangeDialog({
  open,
  onOpenChange,
  orderId,
  currentStatus,
  currentNote,
  onUpdated,
}: PaymentChangeDialogProps) {
  const [status, setStatus] = useState<PaymentStatus>(currentStatus);
  const [note, setNote] = useState(currentNote ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  // Reset the form to the order's current payment on each open transition
  // (closed→open), adjusting state during render rather than in an effect.
  if (open && !wasOpen) {
    setWasOpen(true);
    setStatus(currentStatus);
    setNote(currentNote ?? "");
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  // The free-text note only applies to PAID_OTHER; the backend clears it for
  // every other status, so mirror that here when detecting changes.
  const noteChanged =
    status === "PAID_OTHER" && note.trim() !== (currentNote ?? "").trim();
  const hasChanges = status !== currentStatus || noteChanged;

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const updated = await updateOrder(orderId, {
        paymentStatus: status,
        paymentNote: status === "PAID_OTHER" ? note.trim() || null : null,
      });
      toast.success("Pagamento atualizado com sucesso");
      // Use the server's resolved values (note is cleared for non-PAID_OTHER).
      onUpdated(updated.paymentStatus, updated.paymentNote);
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Falha ao atualizar o pagamento",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar pagamento</DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-col gap-2">
              <span>Selecione a nova situação de pagamento da ordem.</span>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                Pagamento atual:{" "}
                <PaymentBadge status={currentStatus} note={currentNote} />
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nova situação</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as PaymentStatus)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {PAYMENT_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {status === "PAID_OTHER" && (
            <div className="space-y-2">
              <Label>Descrição do pagamento</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex.: Cheque, vale, permuta…"
                rows={2}
              />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={submitting || !hasChanges}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Salvando…" : "Confirmar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
