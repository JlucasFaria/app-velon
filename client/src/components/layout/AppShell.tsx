import { useState } from "react";
import type { ReactNode } from "react";
import { Sidebar, MobileSidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <MobileSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar onMenuClick={() => setMenuOpen(true)} />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-[1180px] px-5 py-7 md:px-7 md:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
