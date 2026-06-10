import { useState } from "react";
import { toast } from "sonner";
import {
  changeOrderStatus,
  type OrderDetail,
  type OrderStatus,
} from "@/api/orders";
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/order-status";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
      toast.success("Status updated successfully");
      onUpdated(updated);
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update status",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change status</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>New status</Label>
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
            <Label>Note (optional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason for the change…"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={submitting || status === currentStatus}
            >
              {submitting ? "Saving…" : "Confirm"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
