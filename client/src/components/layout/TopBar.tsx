import { LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/auth-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function TopBar() {
  const { user, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <header className="flex h-14 items-center justify-end gap-1 border-b bg-card px-6 print:hidden">
      <Button
        variant="ghost"
        size="icon"
        aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
        title={isDark ? "Tema claro" : "Tema escuro"}
        onClick={() => setTheme(isDark ? "light" : "dark")}
      >
        <Sun className="h-5 w-5 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute h-5 w-5 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
        <span className="sr-only">Alternar tema</span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 px-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="max-w-48 truncate text-sm">{user?.email}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => void logout()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
