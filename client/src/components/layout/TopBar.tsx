import { LogOut, Menu, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/auth-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <header className="flex h-14 items-center justify-between gap-2 border-b border-border bg-card px-4 md:px-6 print:hidden">
      {/* Mobile brand + menu toggle */}
      <div className="flex items-center gap-2 md:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="min-h-9 min-w-9"
          aria-label="Abrir menu"
          onClick={onMenuClick}
        >
          <Menu className="h-4 w-4" strokeWidth={1.75} />
        </Button>
        <span className="text-sm font-semibold tracking-tight text-primary">Velon</span>
      </div>

      {/* Spacer so actions stay right-aligned on desktop too */}
      <div className="hidden md:flex flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="relative min-h-9 min-w-9 text-muted-foreground hover:text-foreground"
          aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
          onClick={() => setTheme(isDark ? "light" : "dark")}
        >
          <Sun className="h-4 w-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" strokeWidth={1.75} />
          <Moon className="absolute h-4 w-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" strokeWidth={1.75} />
          <span className="sr-only">Alternar tema</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 px-2 h-9 text-muted-foreground hover:text-foreground"
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-[10px] font-semibold bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-40 truncate text-xs sm:block">
                {user?.email}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <div className="px-2 py-1.5">
              <p className="text-xs font-medium text-foreground truncate">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive focus:bg-destructive/10"
              onClick={() => void logout()}
            >
              <LogOut className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
