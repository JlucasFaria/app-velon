import type { StatusHistoryEntry } from "@/api/orders";
import { formatDateTime } from "@/lib/format";
import { ORDER_STATUS_DOT_CLASSES } from "@/lib/order-status";
import { cn } from "@/lib/utils";
import { OrderStatusBadge } from "./OrderStatusBadge";

export function StatusTimeline({
  entries,
}: {
  entries: StatusHistoryEntry[];
}) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sem histórico de status ainda.
      </p>
    );
  }

  const ordered = [...entries].reverse();

  return (
    <ol className="relative space-y-5 border-l border-border pl-5">
      {ordered.map((entry) => (
        <li key={entry.id} className="relative space-y-1.5">
          <span
            className={cn(
              "absolute top-1.5 -left-[1.4375rem] h-2.5 w-2.5 rounded-full ring-4 ring-primary/10",
              ORDER_STATUS_DOT_CLASSES[entry.toStatus as keyof typeof ORDER_STATUS_DOT_CLASSES] ?? "bg-primary",
            )}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {entry.fromStatus ? (
              <>
                <OrderStatusBadge status={entry.fromStatus} />
                <span className="text-xs text-muted-foreground">→</span>
                <OrderStatusBadge status={entry.toStatus} />
              </>
            ) : (
              <OrderStatusBadge status={entry.toStatus} />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {entry.changedBy.name ?? entry.changedBy.email} ·{" "}
            {formatDateTime(entry.changedAt)}
          </p>
          {entry.note && (
            <p className="rounded-md bg-muted/50 px-2.5 py-1.5 text-xs text-foreground">
              {entry.note}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
