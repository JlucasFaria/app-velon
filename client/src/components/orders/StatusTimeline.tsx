import type { StatusHistoryEntry } from "@/api/orders";
import { formatDateTime } from "@/lib/format";
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

  // Most recent change first.
  const ordered = [...entries].reverse();

  return (
    <ol className="relative space-y-6 border-l border-border pl-6">
      {ordered.map((entry) => (
        <li key={entry.id} className="relative space-y-1">
          <span className="absolute top-1 -left-[1.6875rem] h-2.5 w-2.5 rounded-full border-2 border-card bg-primary" />
          <div className="flex flex-wrap items-center gap-2">
            {entry.fromStatus ? (
              <>
                <OrderStatusBadge status={entry.fromStatus} />
                <span className="text-muted-foreground">→</span>
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
          {entry.note && <p className="text-sm">{entry.note}</p>}
        </li>
      ))}
    </ol>
  );
}
