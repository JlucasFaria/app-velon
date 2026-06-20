import type { ReactNode } from "react";
import { CheckCircle2, ClipboardList, Receipt } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

interface ArtContent {
  headline: ReactNode;
  subtitle: string;
}

/**
 * Split auth layout — form pane on the left, illustrated azure panel on the
 * right (hidden below `lg`). Reproduced from the Velon design reference
 * (client/design-ref/velon-design-system.css: .auth-split / .auth-art).
 */
export function AuthLayout({
  title,
  subtitle,
  footer,
  art,
  children,
}: {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  art: ArtContent;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.04fr_1fr]">
      <div className="flex flex-col items-center justify-center bg-card px-6 py-12 sm:px-12">
        <div className="w-full max-w-[392px]">
          <Logo size={30} className="mb-10" />
          <h1 className="text-[27px] font-extrabold leading-[1.12] tracking-[-0.03em] text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="mb-7 mt-1.5 text-[15px] text-muted-foreground">
              {subtitle}
            </p>
          )}
          {children}
          {footer && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              {footer}
            </p>
          )}
        </div>
      </div>
      <AuthArt {...art} />
    </div>
  );
}

/** Decorative streaks drifting across the panel (matches `.art-streaks`). */
const STREAKS = [
  { top: 44, right: 22, w: 120, h: 5, opacity: 0.55, delay: 0 },
  { top: 58, right: 48, w: 86, h: 6, opacity: 0.55, delay: 0.4 },
  { top: 33, right: 22, w: 150, h: 5, opacity: 0.55, delay: 0.8 },
  { top: 70, right: 32, w: 100, h: 6, opacity: 0.55, delay: 0.2 },
  { top: 26, right: 32, w: 70, h: 4, opacity: 0.7, delay: 0.6 },
  { top: 64, right: 36, w: 134, h: 5, opacity: 0.55, delay: 1 },
];

function AuthArt({ headline, subtitle }: ArtContent) {
  return (
    <div
      className="relative hidden flex-col justify-center overflow-hidden px-14 py-16 lg:flex"
      style={{
        background:
          "linear-gradient(157deg, #2E6AD0 0%, #1E4F94 32%, #15375C 62%, #0B1A2E 100%)",
      }}
    >
      {/* ambient glows */}
      <div
        className="pointer-events-none absolute -right-32 -top-40 h-[460px] w-[460px] rounded-full blur-lg"
        style={{
          background:
            "radial-gradient(circle, rgba(120,180,235,0.30) 0%, transparent 65%)",
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-36 -left-32 h-[380px] w-[380px] rounded-full blur-lg"
        style={{
          background:
            "radial-gradient(circle, rgba(70,120,180,0.30) 0%, transparent 65%)",
        }}
      />

      {/* drifting streaks */}
      <div className="pointer-events-none absolute inset-0 opacity-90">
        {STREAKS.map((s, i) => (
          <span
            key={i}
            className="absolute rounded-full motion-safe:animate-[streak_6s_ease-in-out_infinite]"
            style={{
              top: `${s.top}%`,
              right: `${s.right}%`,
              width: s.w,
              height: s.h,
              opacity: s.opacity,
              animationDelay: `${s.delay}s`,
              background:
                "linear-gradient(90deg, transparent 0%, rgba(176,210,240,0.9) 100%)",
            }}
          />
        ))}
      </div>

      <div className="relative z-10 mb-10 max-w-[380px]">
        <Logo size={30} tone="onPrimary" className="mb-7" />
        <h2 className="text-[30px] font-extrabold leading-[1.18] tracking-[-0.03em] text-white">
          {headline}
        </h2>
        <p className="mt-3.5 text-[15.5px] leading-relaxed text-[rgba(226,238,250,0.78)]">
          {subtitle}
        </p>
      </div>

      <div className="relative z-10 max-w-[420px]">
        <OrdersMockCard />
        <FloatingChip
          className="motion-safe:animate-[floaty_7s_ease-in-out_infinite_0.8s] absolute -right-4 -top-5"
          icon={<CheckCircle2 className="h-4 w-4 text-[#07795f]" />}
          iconBg="#d4f0e4"
          label="Recibo gerado"
        />
        <FloatingChip
          className="motion-safe:animate-[floaty_7s_ease-in-out_infinite_1.6s] absolute -bottom-6 -left-5"
          icon={<Receipt className="h-4 w-4 text-[#1e548c]" />}
          iconBg="#e7eff8"
          label="R$ 1.160 no mês"
        />
      </div>
    </div>
  );
}

function OrdersMockCard() {
  const rows = [
    { initials: "MC", color: "#1e548c", status: "Em andamento", dot: "#0e8fa8", fg: "#0c6577", bg: "#d7edf3", w: "60%", w2: "38%" },
    { initials: "CR", color: "#0e9f7c", status: "Concluída", dot: "#0e9f7c", fg: "#07795f", bg: "#d4f0e4", w: "72%", w2: "30%" },
    { initials: "AP", color: "#c8870f", status: "Pendente", dot: "#c8870f", fg: "#93590c", bg: "#faebd0", w: "52%", w2: "44%" },
  ];
  return (
    <div className="motion-safe:animate-[floaty_7s_ease-in-out_infinite] w-full rounded-[18px] bg-white p-[18px] shadow-[0_40px_80px_-24px_rgba(5,15,30,0.55),0_12px_28px_-10px_rgba(5,15,30,0.4)]">
      <div className="flex items-center gap-2.5 border-b border-[#EEF1F4] px-1 pb-3.5">
        <ClipboardList className="h-[17px] w-[17px] text-[#1e548c]" />
        <span className="text-[13.5px] font-bold text-[#1B2430]">
          Ordens de serviço
        </span>
        <span className="ml-auto rounded-full bg-[#e7eff8] px-2.5 py-1 text-[11px] font-bold text-[#1b4c82]">
          7 ativas
        </span>
      </div>
      {rows.map((r, i) => (
        <div
          key={r.initials}
          className="flex items-center gap-3 px-1 py-3.5"
          style={{ borderBottom: i < rows.length - 1 ? "1px solid #F2F4F6" : undefined }}
        >
          <span
            className="grid h-[30px] w-[30px] flex-shrink-0 place-items-center rounded-[9px] text-[11px] font-bold text-white"
            style={{ background: r.color }}
          >
            {r.initials}
          </span>
          <div className="flex flex-1 flex-col gap-1.5">
            <span className="h-[7px] rounded bg-[#EAEDF1]" style={{ width: r.w }} />
            <span className="h-[7px] rounded bg-[#EAEDF1]" style={{ width: r.w2 }} />
          </div>
          <span
            className="inline-flex h-[22px] flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold"
            style={{ background: r.bg, color: r.fg }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.dot }} />
            {r.status}
          </span>
        </div>
      ))}
    </div>
  );
}

function FloatingChip({
  className,
  icon,
  iconBg,
  label,
}: {
  className?: string;
  icon: ReactNode;
  iconBg: string;
  label: string;
}) {
  return (
    <div
      className={`z-20 flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-[12.5px] font-bold text-[#1B2430] shadow-[0_18px_36px_-12px_rgba(5,15,30,0.5)] ${className ?? ""}`}
    >
      <span
        className="grid h-[26px] w-[26px] place-items-center rounded-lg"
        style={{ background: iconBg }}
      >
        {icon}
      </span>
      {label}
    </div>
  );
}
