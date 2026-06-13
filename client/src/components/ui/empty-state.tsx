import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-5 rounded-2xl border border-dashed border-border bg-card px-8 py-16 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="relative flex size-20 items-center justify-center">
          <div aria-hidden="true" className="absolute inset-0 rounded-2xl bg-primary/8" />
          <div aria-hidden="true" className="absolute inset-2 rounded-xl bg-primary/14" />
          <Icon className="relative size-9 text-primary/65" />
        </div>
      ) : null}
      <div className="space-y-1.5 max-w-xs">
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        {description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
