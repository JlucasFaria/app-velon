import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Empty state inside a dashed frame, with the design's illustrated art:
 * a soft radial halo (`ring`), an elevated glyph tile, and two accent sparks.
 * Mirrors `.frame-empty` / `.empty` / `.empty-art` from the design reference.
 */
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
        "flex flex-col items-center justify-center rounded-[18px] border border-dashed border-border bg-muted/40 px-6 py-14 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="relative mb-[22px] grid size-[92px] place-items-center">
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-[24px]"
            style={{
              background:
                "radial-gradient(120% 120% at 50% 0%, var(--velon-primary-soft) 0%, transparent 70%)",
            }}
          />
          <div className="relative grid size-[60px] place-items-center rounded-[18px] border border-border bg-card text-primary shadow-elevated">
            <Icon className="size-[27px]" />
          </div>
          <span
            aria-hidden="true"
            className="absolute right-3 top-1.5 size-2 rounded-full bg-[#e0a23e] opacity-85"
          />
          <span
            aria-hidden="true"
            className="absolute bottom-3 left-2 size-[5px] rounded-full bg-primary opacity-70"
          />
        </div>
      ) : null}
      <div className="max-w-[360px] space-y-1.5">
        <h3 className="text-[16.5px] font-bold tracking-[-0.01em] text-foreground">
          {title}
        </h3>
        {description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
