import type { ElementType } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  BarChart2,
  Building2,
  LogOut,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { ROLE_LABELS } from "@/components/members/member-constants";
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
  { to: "/orders", label: "Ordens de serviço", icon: ClipboardList },
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
    <nav className="flex flex-1 flex-col gap-[3px] px-3.5 py-4">
      <span className="px-3 pb-1.5 pt-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">
        Gestão
      </span>
      {navItems.map(({ to, label, icon: Icon, end = false }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "group relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14.5px] font-semibold transition-colors duration-150",
              isActive
                ? "bg-accent text-accent-foreground before:absolute before:-left-3.5 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r-[3px] before:bg-primary before:content-['']"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon
                className={cn(
                  "h-[19px] w-[19px] shrink-0 transition-colors",
                  isActive
                    ? "text-primary"
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

function UserChip() {
  const { user, logout } = useAuth();
  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();
  const roleLabel = user?.role ? ROLE_LABELS[user.role] : null;

  return (
    <div className="border-t border-border/70 p-3.5">
      <div className="flex items-center gap-2.5 rounded-[10px] p-2 transition-colors hover:bg-muted">
        <span className="grid size-[34px] shrink-0 place-items-center rounded-full bg-accent text-[12.5px] font-bold text-accent-foreground">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold">
            {user?.email}
          </div>
          {roleLabel && (
            <div className="text-[12px] text-muted-foreground/70">
              {roleLabel}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Sair"
          onClick={() => void logout()}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-border bg-sidebar md:flex print:hidden">
      <div className="flex h-[68px] items-center border-b border-border/70 px-5">
        <Brand />
      </div>
      <NavItems />
      <UserChip />
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
        <div className="flex h-[68px] items-center justify-between border-b border-border/70 px-5">
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
        <UserChip />
      </aside>
    </div>
  );
}
