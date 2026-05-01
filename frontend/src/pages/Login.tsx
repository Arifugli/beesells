import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { Loader2, Eye, EyeOff, HelpCircle, X, ShieldCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Role = "operator" | "manager" | "admin";

export default function Login() {
  const { login } = useAuth();
  const [tab, setTab] = useState<Role>("operator");
  const [selectedId, setSelectedId] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["auth-users", tab],
    queryFn: () => api.auth.users(tab === "admin" ? undefined : tab),
    enabled: tab !== "admin",
  });

  const adminMutation = useMutation({
    mutationFn: () => api.auth.loginAdmin(password),
    onSuccess: (data) => login(data.token, data.user),
    onError: () => toast("Неверный пароль", "error"),
  });

  const selectMutation = useMutation({
    mutationFn: async () => {
      const id = Number(selectedId);
      const user = users.find(u => u.id === id);
      if (!user) throw new Error("Выберите пользователя");
      if (user.hasPassword) {
        if (!password) throw new Error("Введите пароль");
        return api.auth.login(user.name, password);
      }
      return api.auth.loginSelect(id);
    },
    onSuccess: (data) => login(data.token, data.user),
    onError: (e: Error) => toast(e.message, "error"),
  });

  const switchTab = (t: Role) => { setTab(t); setSelectedId(""); setPassword(""); };
  const selectedUser = users.find(u => u.id === Number(selectedId));
  const needsPassword = !!selectedUser?.hasPassword;

  const tabs: { key: Role; label: string }[] = [
    { key: "operator", label: "Оператор" },
    { key: "manager", label: "Менеджер" },
    { key: "admin", label: "Админ" },
  ];

  return (
    <div className="min-h-screen flex" style={{ background: "#F5F5F5" }}>
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-80 shrink-0 p-10"
        style={{ background: "#1A1A1A" }}>
        <div>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-8"
            style={{ background: "#FFD200" }}>
            <span className="font-black text-black text-base">bee</span>
          </div>
          <h1 className="text-white text-3xl font-bold leading-tight mb-3">
            BeeSells
          </h1>
          <p className="text-[#888] text-sm leading-relaxed">
            Система управления продажами и KPI для полевых сотрудников Beeline Uzbekistan
          </p>
        </div>

        <div className="space-y-3">
          {[
            { label: "Отслеживание KPI", desc: "Планы и факты в реальном времени" },
            { label: "Рейтинг операторов", desc: "Сравнение по всем показателям" },
            { label: "Импорт из Excel", desc: "Быстрая загрузка данных" },
          ].map(f => (
            <div key={f.label} className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: "#FFD200" }} />
              <div>
                <p className="text-white text-sm font-medium">{f.label}</p>
                <p className="text-[#666] text-xs mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "#FFD200" }}>
              <span className="font-black text-black text-sm">bee</span>
            </div>
            <span className="font-bold text-xl text-[#1A1A1A]">BeeSells</span>
          </div>

          <h2 className="text-2xl font-bold text-[#1A1A1A] mb-1">Вход в систему</h2>
          <p className="text-[#888] text-sm mb-7">Выберите роль и введите данные</p>

          {/* Role tabs */}
          <div className="flex gap-1 p-1 rounded-xl mb-6"
            style={{ background: "#EBEBEB" }}>
            {tabs.map(t => (
              <button key={t.key} onClick={() => switchTab(t.key)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: tab === t.key ? "#FFD200" : "transparent",
                  color: tab === t.key ? "#1A1A1A" : "#888",
                  boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Admin form */}
          {tab === "admin" && (
            <form onSubmit={e => { e.preventDefault(); if (!password) { toast("Введите пароль", "error"); return; } adminMutation.mutate(); }}
              className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[#1A1A1A] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-red-500" />
                  Пароль администратора
                </label>
                <div className="relative">
                  <input type={showPwd ? "text" : "password"} value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Введите пароль"
                    className="input pr-10" autoFocus />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999] hover:text-[#1A1A1A]">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={!password || adminMutation.isPending}
                className="btn-primary w-full h-11 text-base">
                {adminMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Войти
              </button>
            </form>
          )}

          {/* Operator / Manager */}
          {tab !== "admin" && (
            <form onSubmit={e => { e.preventDefault(); if (!selectedId) { toast("Выберите пользователя", "error"); return; } selectMutation.mutate(); }}
              className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[#1A1A1A]">
                  {tab === "operator" ? "Выберите оператора" : "Выберите менеджера"}
                </label>
                <select value={selectedId}
                  onChange={e => { setSelectedId(e.target.value); setPassword(""); }}
                  className="select" disabled={isLoading}>
                  <option value="">{isLoading ? "Загрузка..." : "— выберите —"}</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name}{u.hasPassword ? " 🔒" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {needsPassword && (
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-[#1A1A1A]">Пароль</label>
                  <div className="relative">
                    <input type={showPwd ? "text" : "password"} value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Введите пароль" className="input pr-10" autoFocus />
                    <button type="button" onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999] hover:text-[#1A1A1A]">
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <button type="submit"
                disabled={!selectedId || (needsPassword && !password) || selectMutation.isPending}
                className="btn-primary w-full h-11 text-base">
                {selectMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Войти
              </button>
            </form>
          )}

          <div className="mt-5 text-center">
            <button onClick={() => setShowHelp(true)}
              className="text-sm text-[#888] hover:text-[#1A1A1A] transition-colors inline-flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" />
              Забыли пароль?
            </button>
          </div>
        </div>
      </div>

      {/* Help modal */}
      {showHelp && (
        <div className="modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="modal max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b border-[#F0F0F0] flex items-center justify-between">
              <h2 className="font-bold text-[#1A1A1A]">Забыли пароль?</h2>
              <button onClick={() => setShowHelp(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-5 space-y-4 text-sm text-[#444]">
              <p>Для сброса пароля обратитесь к руководителю:</p>
              <div className="space-y-2.5">
                {[
                  { role: "Оператор", hint: "обратитесь к своему менеджеру", color: "#1A1A1A" },
                  { role: "Менеджер", hint: "обратитесь к администратору", color: "#1A1A1A" },
                  { role: "Администратор", hint: "пароль меняется в разделе KPI категорий", color: "#dc2626" },
                ].map(r => (
                  <div key={r.role} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "#F8F8F8" }}>
                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: "#FFD200" }} />
                    <div>
                      <span className="font-semibold" style={{ color: r.color }}>{r.role}</span>
                      <span className="text-[#666]"> — {r.hint}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 pb-6">
              <button onClick={() => setShowHelp(false)} className="btn-primary w-full">Понятно</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
