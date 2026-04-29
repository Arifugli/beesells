import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { Signal, Loader2, ShieldCheck, Eye, EyeOff, HelpCircle, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Role = "operator" | "manager" | "admin";

export default function Login() {
  const { login } = useAuth();
  const [tab, setTab] = useState<Role>("operator");
  const [selectedId, setSelectedId] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Load all users for this role
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["auth-users", tab],
    queryFn: () => api.auth.users(tab === "admin" ? undefined : tab),
    enabled: tab !== "admin",
  });

  // Admin login
  const adminMutation = useMutation({
    mutationFn: () => api.auth.loginAdmin(password),
    onSuccess: (data) => login(data.token, data.user),
    onError: () => toast("Неверный пароль", "error"),
  });

  // Login by selecting from list + optional password
  const selectMutation = useMutation({
    mutationFn: async () => {
      const id = Number(selectedId);
      const user = users.find(u => u.id === id);
      if (!user) throw new Error("Выберите пользователя");

      if (user.hasPassword) {
        // Has password — use name-based login
        if (!password) throw new Error("Введите пароль");
        return api.auth.login(user.name, password);
      } else {
        // No password — passwordless select
        return api.auth.loginSelect(id);
      }
    },
    onSuccess: (data) => login(data.token, data.user),
    onError: (e: Error) => toast(e.message, "error"),
  });

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) { toast("Введите пароль", "error"); return; }
    adminMutation.mutate();
  };

  const handleSelectLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) { toast("Выберите пользователя", "error"); return; }
    selectMutation.mutate();
  };

  const switchTab = (t: Role) => {
    setTab(t);
    setSelectedId("");
    setPassword("");
  };

  const selectedUser = users.find(u => u.id === Number(selectedId));
  const needsPassword = !!selectedUser?.hasPassword;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      <div className="mb-8 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
          style={{ background: "hsl(var(--primary))" }}>
          <Signal className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">TelecomSales</h1>
      </div>

      <div className="card w-full max-w-md shadow-xl p-8 space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Вход в систему</h2>
          <p className="text-gray-500 text-sm mt-1">Выберите роль и войдите</p>
        </div>

        {/* Role tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(["operator", "manager", "admin"] as Role[]).map(t => (
            <button key={t} onClick={() => switchTab(t)}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${
                tab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}>
              {t === "operator" ? "Оператор" : t === "manager" ? "Менеджер" : "Админ"}
            </button>
          ))}
        </div>

        {/* Admin */}
        {tab === "admin" && (
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-red-500" />
                Пароль администратора
              </label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Введите пароль"
                  className="input pr-10"
                  autoFocus
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={!password || adminMutation.isPending} className="btn-primary w-full">
              {adminMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Войти как администратор
            </button>
          </form>
        )}

        {/* Operator / Manager */}
        {tab !== "admin" && (
          <form onSubmit={handleSelectLogin} className="space-y-4">
            {/* Select user from list */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {tab === "operator" ? "Выберите оператора" : "Выберите менеджера"}
              </label>
              <select
                value={selectedId}
                onChange={e => { setSelectedId(e.target.value); setPassword(""); }}
                className="select"
                disabled={isLoading}
              >
                <option value="">{isLoading ? "Загрузка..." : "— выберите —"}</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name}{u.hasPassword ? " 🔒" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Password field — shown only if selected user has a password */}
            {needsPassword && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Пароль</label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Введите пароль"
                    className="input pr-10"
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={!selectedId || (needsPassword && !password) || selectMutation.isPending}
              className="btn-primary w-full"
            >
              {selectMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Войти
            </button>
          </form>
        )}

        <div className="text-center">
          <button onClick={() => setShowHelp(true)}
            className="text-sm text-indigo-500 hover:text-indigo-700 transition-colors inline-flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5" />
            Забыли пароль?
          </button>
        </div>
      </div>

      {/* Help modal */}
      {showHelp && (
        <div className="modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="modal max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Забыли пароль?</h2>
              <button onClick={() => setShowHelp(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3 text-sm text-gray-600">
              <p>Для сброса пароля обратитесь к вашему руководителю:</p>
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <p className="flex items-start gap-2">
                  <span className="font-semibold text-indigo-600 shrink-0">Оператор</span>
                  <span>→ обратитесь к своему менеджеру</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="font-semibold text-indigo-600 shrink-0">Менеджер</span>
                  <span>→ обратитесь к администратору</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="font-semibold text-red-500 shrink-0">Администратор</span>
                  <span>→ пароль меняется в разделе KPI категорий</span>
                </p>
              </div>
              <p className="text-gray-400 text-xs">Руководитель может сменить ваш пароль через панель управления в разделе редактирования профиля.</p>
            </div>
            <div className="mt-5">
              <button onClick={() => setShowHelp(false)} className="btn-primary w-full">Понятно</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
