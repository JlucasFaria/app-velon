import { Bell, Menu } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { InitialsAvatar } from "@/components/ui/initials-avatar";

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user } = useAuth();
  const displayName = user?.name ?? user?.email ?? "—";

  return (
    <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between gap-2 border-b border-border bg-background/75 px-4 backdrop-blur-md backdrop-saturate-150 md:px-7 print:hidden">
      {/* Left — mobile menu + logo (empty on desktop) */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="min-h-9 min-w-9 md:hidden"
          aria-label="Abrir menu"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Logo size={22} className="md:hidden" />
      </div>

      {/* Right — theme, notifications, user */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="min-h-9 min-w-9 text-muted-foreground hover:text-foreground"
          aria-label="Notificações"
          onClick={() => toast.info("Você não tem notificações no momento.")}
        >
          <Bell className="h-[18px] w-[18px]" />
        </Button>

        <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

        <div className="flex items-center gap-2 pr-0.5">
          <InitialsAvatar name={displayName} round size={30} />
          <span className="hidden max-w-40 truncate text-[13.5px] font-medium sm:block">
            {displayName}
          </span>
        </div>
      </div>
    </header>
  );
}
