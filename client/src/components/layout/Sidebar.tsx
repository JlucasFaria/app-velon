import type { ElementType } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  BarChart2,
  Building2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";

interface NavItem {
  to: string;
  label: string;
  icon: ElementType;
  end?: boolean;
}

const navItems: NavItem[] = [
  { to: "/", label: "Painel", icon: LayoutDashboard, end: true },
  { to: "/clients", label: "Clientes", icon: Users },
  { to: "/orders", label: "Ordens de Serviço", icon: ClipboardList },
  { to: "/reports", label: "Relatórios", icon: BarChart2 },
  { to: "/profile", label: "Perfil", icon: Building2 },
];

function Brand() {
  return (
    <div className="flex items-center">
      <Logo size={26} />
    </div>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
      {navItems.map(({ to, label, icon: Icon, end = false }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0 transition-colors",
                  isActive
                    ? "text-primary-foreground"
                    : "text-muted-foreground group-hover:text-foreground",
                )}
              />
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar md:flex print:hidden">
      <div className="flex h-16 items-center border-b border-border px-5">
        <Brand />
      </div>
      <NavItems />
    </aside>
  );
}

export function MobileSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className={cn("fixed inset-0 z-50 md:hidden", !open && "pointer-events-none")}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegação"
        inert={!open}
        className={cn(
          "absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-sidebar shadow-overlay transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <Brand />
          <Button
            variant="ghost"
            size="icon"
            className="min-h-9 min-w-9"
            aria-label="Fechar menu"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <NavItems onNavigate={onClose} />
      </aside>
    </div>
  );
}
