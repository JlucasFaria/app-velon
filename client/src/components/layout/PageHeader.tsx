import type { ReactNode } from "react";

/**
 * Standard page header — title + optional subtitle on the left, actions on the
 * right. Mirrors `.page-hd` / `.h-page` from the Velon design reference.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-extrabold leading-[1.1] tracking-[-0.025em]">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[14.5px] text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
