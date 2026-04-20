import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { LogOut, LayoutDashboard, FileEdit, Users, Signal, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) return <>{children}</>;

  const isManager = user.role === "manager";
  const navItems = isManager
    ? [
        { label: "Обзор", href: "/manager", icon: LayoutDashboard },
        { label: "Команда", href: "/manager/operators", icon: Users },
      ]
    : [
        { label: "Мои показатели", href: "/operator", icon: LayoutDashboard },
        { label: "Записать продажи", href: "/operator/log", icon: FileEdit },
      ];

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="h-16 flex items-center px-6 border-b border-border">
        <div className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight">
          <Signal className="w-6 h-6" />
          <span>TelecomSales</span>
        </div>
      </div>

      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {isManager ? "Менеджер" : "Оператор"}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1">
        {navItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <div
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer",
                  isActive
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <button
          onClick={() => logout()}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Выйти
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-card border-r border-border flex-col shrink-0">
        {sidebar}
      </aside>

      {/* Mobile header */}
      <div className="md:hidden h-14 bg-card border-b border-border flex items-center px-4 gap-3 shrink-0">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-md hover:bg-secondary transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 text-primary font-bold tracking-tight">
          <Signal className="w-5 h-5" />
          <span>TelecomSales</span>
        </div>
      </div>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative w-72 bg-card border-r border-border flex flex-col">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-md hover:bg-secondary"
            >
              <X className="w-4 h-4" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
