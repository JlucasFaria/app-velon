import type { StatusHistoryEntry } from "@/api/orders";
import { OrderStatusBadge } from "./OrderStatusBadge";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function StatusTimeline({
  entries,
}: {
  entries: StatusHistoryEntry[];
}) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No status history yet.</p>
    );
  }

  // Most recent change first.
  const ordered = [...entries].reverse();

  return (
    <ol className="space-y-5">
      {ordered.map((entry) => (
        <li key={entry.id} className="flex gap-3">
          <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
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
          </div>
        </li>
      ))}
    </ol>
  );
}
