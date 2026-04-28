import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Signal, LogOut, Menu, X, LayoutDashboard, Users, Building2, Tag, FileEdit, ShieldCheck, Wifi, FileUp } from "lucide-react";

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  if (!user) return <>{children}</>;

  const navItems = user.role === "admin" ? [
    { label: "Отделения", href: "/admin/branches", icon: Building2 },
    { label: "Менеджеры", href: "/admin/managers", icon: Users },
    { label: "KPI категории", href: "/admin/kpi", icon: Tag },
    { label: "Тарифы", href: "/admin/tariffs", icon: Wifi },
    { label: "Импорт Excel", href: "/import", icon: FileUp },
  ] : user.role === "manager" ? [
    { label: "Обзор команды", href: "/manager", icon: LayoutDashboard },
    { label: "Операторы", href: "/manager/operators", icon: Users },
    { label: "Импорт Excel", href: "/import", icon: FileUp },
  ] : [
    { label: "Мои показатели", href: "/operator", icon: LayoutDashboard },
    { label: "Записать KPI", href: "/operator/log", icon: FileEdit },
  ];

  const roleLabel = user.role === "admin" ? "Администратор" : user.role === "manager" ? "Менеджер" : "Оператор";
  const roleColor = user.role === "admin" ? "badge-danger" : user.role === "manager" ? "badge-primary" : "badge-muted";

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="h-16 flex items-center px-6 border-b border-gray-100">
        <div className="flex items-center gap-2 font-bold text-lg" style={{ color: "hsl(var(--primary))" }}>
          <Signal className="w-5 h-5" />
          <span>TelecomSales</span>
        </div>
      </div>

      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0"
            style={{ background: "hsl(var(--primary))" }}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <span className={`badge ${roleColor} text-xs mt-0.5`}>
              {user.role === "admin" && <ShieldCheck className="w-3 h-3" />}
              {roleLabel}
            </span>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(item => {
          const active = location === item.href || location.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <div onClick={() => setOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all ${
                active ? "text-white shadow-sm" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              }`} style={active ? { background: "hsl(var(--primary))" } : {}}>
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-gray-100">
        <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all">
          <LogOut className="w-4 h-4" />
          Выйти
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 bg-white border-r border-gray-100 flex-col shrink-0 sticky top-0 h-screen">
        {sidebar}
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-gray-100 flex items-center px-4 gap-3">
        <button onClick={() => setOpen(true)} className="btn-ghost"><Menu className="w-5 h-5" /></button>
        <div className="flex items-center gap-2 font-bold" style={{ color: "hsl(var(--primary))" }}>
          <Signal className="w-4 h-4" /><span>TelecomSales</span>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="relative w-64 bg-white flex flex-col h-full shadow-xl">
            <button onClick={() => setOpen(false)} className="absolute top-4 right-4 btn-ghost"><X className="w-4 h-4" /></button>
            {sidebar}
          </aside>
        </div>
      )}

      <main className="flex-1 overflow-auto md:pt-0 pt-14">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
