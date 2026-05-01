import { useState } from "react";
import { Link } from "wouter";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard, Users, Building2, Tag, FileEdit,
  LogOut, Menu, X, Wifi, FileUp, ChevronRight
} from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) return null;

  const navItems = user.role === "admin" ? [
    { label: "Отделения", href: "/admin/branches", icon: Building2 },
    { label: "Менеджеры", href: "/admin/managers", icon: Users },
    { label: "KPI категории", href: "/admin/kpi", icon: Tag },
    { label: "Тарифы", href: "/admin/tariffs", icon: Wifi },
    { label: "Импорт Excel", href: "/import", icon: FileUp },
  ] : user.role === "manager" ? [
    { label: "Дашборд", href: "/manager", icon: LayoutDashboard },
    { label: "Операторы", href: "/manager/operators", icon: Users },
    { label: "Импорт Excel", href: "/import", icon: FileUp },
  ] : [
    { label: "Мой дашборд", href: "/operator", icon: LayoutDashboard },
    { label: "Записать данные", href: "/operator/log", icon: FileEdit },
  ];

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-[#2A2A2A]">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "#FFD200" }}>
          <span className="text-black font-black text-xs leading-none">bee</span>
        </div>
        <div>
          <p className="font-bold text-white text-sm leading-tight">BeeSells</p>
          <p className="text-[#6B6B6B] text-xs leading-tight capitalize">{
            user.role === "admin" ? "Администратор"
            : user.role === "manager" ? "Менеджер"
            : "Оператор"
          }</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = location === href || location.startsWith(href + "/");
          return (
            <Link key={href} href={href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                active
                  ? "bg-[#FFD200] text-[#1A1A1A]"
                  : "text-[#BBBBBB] hover:bg-[#2A2A2A] hover:text-white"
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? "text-[#1A1A1A]" : "text-[#888]"}`} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-4 border-t border-[#2A2A2A]">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg mb-1">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm"
            style={{ background: "#FFD200", color: "#1A1A1A" }}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user.name}</p>
          </div>
        </div>
        <button onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#888] hover:bg-[#2A2A2A] hover:text-red-400 transition-all">
          <LogOut className="w-4 h-4" />
          Выйти
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#F5F5F5]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 bg-[#1A1A1A]">
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-56 bg-[#1A1A1A] z-50">
            <Sidebar />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-[#EBEBEB]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: "#FFD200" }}>
              <span className="text-black font-black text-[10px]">bee</span>
            </div>
            <span className="font-bold text-sm">BeeSells</span>
          </div>
          <button onClick={() => setSidebarOpen(true)} className="btn-ghost">
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
