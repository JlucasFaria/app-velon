import { useState } from "react";
import { cn } from "@/lib/utils";
import velonLogo from "@/assets/velon-logo.png";

type LogoTone = "brand" | "onPrimary";

interface LogoProps {
  /** Pixel height of the logo; width scales automatically. */
  size?: number;
  /** "brand" → navy logo on light surfaces · "onPrimary" → white logo on the azure panel. */
  tone?: LogoTone;
  className?: string;
}

/**
 * Velon logo — the real wordmark asset (client/src/assets/velon-logo.png).
 * On the azure auth panel the white variant is derived with a CSS filter
 * (the design's own technique), avoiding a second asset. Falls back to an
 * inline SVG wordmark if the image fails to load.
 */
export function Logo({ size = 28, tone = "brand", className }: LogoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <LogoFallback size={size} tone={tone} className={className} />;
  }

  return (
    <img
      src={velonLogo}
      alt="Velon"
      draggable={false}
      onError={() => setFailed(true)}
      className={cn("w-auto select-none", className)}
      style={{
        height: size,
        filter: tone === "onPrimary" ? "brightness(0) invert(1)" : undefined,
      }}
    />
  );
}

/** Inline SVG wordmark — fallback only, used if the logo image fails to load. */
function LogoFallback({
  size,
  tone,
  className,
}: {
  size: number;
  tone: LogoTone;
  className?: string;
}) {
  const wordmark = tone === "onPrimary" ? "#ffffff" : "var(--velon-navy)";
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
          color: wordmark,
          fontWeight: 800,
          fontSize: size * 0.92,
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}
      >
        Velon
      </span>
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
    </span>
  );
}
