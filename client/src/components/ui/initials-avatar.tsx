import { cn } from "@/lib/utils";

/** First letters of up to two name words, uppercased (e.g. "Mariana Costa" → "MC"). */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return initials || "?";
}

/**
 * Initials avatar tile — mirrors `.avatar` from the design reference.
 * `primary` uses the azure soft surface, `warm` the amber accent (used to mark
 * partner/company clients). `round` switches to a circle (user chips).
 */
export function InitialsAvatar({
  name,
  variant = "primary",
  round = false,
  className,
}: {
  name: string;
  variant?: "primary" | "warm";
  round?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid size-[34px] shrink-0 place-items-center border text-[12.5px] font-bold",
        round ? "rounded-full" : "rounded-[10px]",
        variant === "warm"
          ? "border-[#f0e2c5] bg-[#fbeeda] text-[#ac7314]"
          : "border-border bg-accent text-accent-foreground",
        className,
      )}
    >
      {getInitials(name)}
    </span>
  );
}
