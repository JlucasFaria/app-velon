import { cn } from "@/lib/utils";

type LogoTone = "brand" | "onPrimary";

interface LogoProps {
  /** Pixel height of the lockup; the wordmark/streaks scale from it. */
  size?: number;
  /** "brand" → navy/azure on light surfaces · "onPrimary" → white on the azure panel. */
  tone?: LogoTone;
  /** Hide the decorative streaks (e.g. very tight spaces). */
  hideStreaks?: boolean;
  className?: string;
}

/**
 * Velon wordmark — "Velon" in Hanken Grotesk 800 with three azure speed
 * streaks, reproduced as inline SVG from the design reference
 * (client/design-ref/velon-design-system.css). Scales crisply and themes
 * via the `tone` prop instead of shipping the 3.9 MB PNG.
 */
export function Logo({
  size = 30,
  tone = "brand",
  hideStreaks = false,
  className,
}: LogoProps) {
  const wordmarkColor = tone === "onPrimary" ? "#ffffff" : "var(--velon-navy)";
  const streaks =
    tone === "onPrimary"
      ? ["#ffffff", "rgba(255,255,255,0.7)", "rgba(255,255,255,0.45)"]
      : ["#2a66d0", "#7fb0e6", "#a9ccee"];

  return (
    <span
      className={cn("inline-flex items-center", className)}
      style={{ height: size, gap: size * 0.3 }}
      aria-label="Velon"
      role="img"
    >
      <span
        style={{
          color: wordmarkColor,
          fontWeight: 800,
          fontSize: size * 0.92,
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}
      >
        Velon
      </span>
      {!hideStreaks && (
        <svg
          width={size * 1.15}
          height={size * 0.7}
          viewBox="0 0 46 28"
          fill="none"
          aria-hidden="true"
        >
          <g strokeLinecap="round" strokeWidth="6">
            <line x1="3" y1="6" x2="43" y2="6" stroke={streaks[0]} />
            <line x1="3" y1="15" x2="33" y2="15" stroke={streaks[1]} />
            <line x1="3" y1="24" x2="23" y2="24" stroke={streaks[2]} />
          </g>
        </svg>
      )}
    </span>
  );
}

/**
 * Compact gradient mark ("V") for tight spots — collapsed sidebar, avatars.
 * Mirrors `.brand-mark` from the design system.
 */
export function BrandMark({
  size = 38,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-grid flex-shrink-0 place-items-center font-extrabold text-white",
        className,
      )}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.29,
        fontSize: size * 0.5,
        letterSpacing: "-0.02em",
        background:
          "linear-gradient(150deg, #2e6ca8 0%, var(--primary) 50%, var(--velon-navy) 100%)",
        boxShadow:
          "0 6px 18px -6px rgba(42,102,208,0.40), inset 0 1px 0 rgba(255,255,255,0.28)",
      }}
      aria-hidden="true"
    >
      V
    </span>
  );
}
