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
    <div className="flex items-center gap-2">
      <div className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
        V
      </div>
      <span className="text-lg font-semibold tracking-tight">Velon</span>
    </div>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {navItems.map(({ to, label, icon: Icon, end = false }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )
          }
        >
          <Icon className="h-4 w-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

/** Static sidebar shown on tablet/desktop (md and up). */
export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex print:hidden">
      <div className="flex h-14 items-center border-b px-6">
        <Brand />
      </div>
      <NavItems />
    </aside>
  );
}

/** Off-canvas navigation drawer for mobile (below md). */
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
          "absolute inset-0 bg-black/50 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegação"
        inert={!open}
        className={cn(
          "absolute inset-y-0 left-0 flex w-64 flex-col border-r bg-card shadow-overlay transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-4">
          <Brand />
          <Button
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11"
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
