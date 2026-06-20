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
  size = 34,
  className,
}: {
  name: string;
  variant?: "primary" | "warm";
  round?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center border font-bold",
        variant === "warm"
          ? "border-[#f0e2c5] bg-[#fbeeda] text-[#ac7314]"
          : "border-border bg-accent text-accent-foreground",
        className,
      )}
      style={{
        width: size,
        height: size,
        borderRadius: round ? 9999 : size * 0.29,
        fontSize: size * 0.36,
      }}
    >
      {getInitials(name)}
    </span>
  );
}
