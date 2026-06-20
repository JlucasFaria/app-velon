import type { ReactNode } from "react";
import { CheckCircle2, Receipt } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

/**
 * Split auth layout — form pane on the left, illustrated azure panel on the
 * right (hidden below `lg`). Reproduced from the Velon design reference
 * (client/design-ref/velon-design-system.css: .auth-split / .auth-art).
 */
export function AuthLayout({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
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
      <AuthArt />
    </div>
  );
}

function AuthArt() {
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

      <div className="relative z-10 mb-10 max-w-[380px]">
        <Logo size={30} tone="onPrimary" className="mb-7" />
        <h2 className="text-[30px] font-extrabold leading-[1.18] tracking-[-0.03em] text-white">
          Tudo pronto
          <br />
          para começar.
        </h2>
        <p className="mt-3.5 text-[15.5px] leading-relaxed text-[rgba(226,238,250,0.78)]">
          Cadastre clientes, monte modelos de serviço e emita recibos em
          segundos.
        </p>
      </div>

      <div className="relative z-10 max-w-[420px]">
        <OrdersMockCard />
        <FloatingChip
          className="motion-safe:animate-[floaty_7s_ease-in-out_infinite_0.8s] absolute -right-4 -top-5"
          icon={<CheckCircle2 className="h-4 w-4 text-[#0e9f7c]" />}
          iconBg="#d4f0e4"
          label="Recibo gerado"
        />
        <FloatingChip
          className="motion-safe:animate-[floaty_7s_ease-in-out_infinite_1.6s] absolute -bottom-6 -left-5"
          icon={<Receipt className="h-4 w-4 text-[#2058bd]" />}
          iconBg="#e7eefb"
          label="R$ 1.160 no mês"
        />
      </div>
    </div>
  );
}

function OrdersMockCard() {
  const rows = [
    { initials: "MC", color: "#2a66d0", status: "Em andamento", dot: "#0e8fa8", fg: "#0c6577", bg: "#d7edf3", w: "62%" },
    { initials: "CR", color: "#0e9f7c", status: "Concluída", dot: "#0e9f7c", fg: "#07795f", bg: "#d4f0e4", w: "74%" },
    { initials: "AP", color: "#e0a23e", status: "Pendente", dot: "#c8870f", fg: "#93590c", bg: "#faebd0", w: "55%" },
  ];
  return (
    <div className="motion-safe:animate-[floaty_7s_ease-in-out_infinite] w-full rounded-[18px] bg-white p-[18px] shadow-[0_40px_80px_-24px_rgba(5,15,30,0.55),0_12px_28px_-10px_rgba(5,15,30,0.4)]">
      <div className="flex items-center gap-2.5 border-b border-[#EEF1F4] px-1 pb-3.5">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#e7eefb] text-[#2058bd]">
          <Receipt className="h-4 w-4" />
        </span>
        <span className="text-[13.5px] font-bold text-[#1B2430]">
          Ordens de serviço
        </span>
        <span className="ml-auto rounded-full bg-[#eef2f8] px-2.5 py-1 text-[11px] font-bold text-[#56627a]">
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
            <span className="h-[7px] w-2/5 rounded bg-[#EAEDF1]" />
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
