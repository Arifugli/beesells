import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { Signal, Loader2, ShieldCheck, Eye, EyeOff, HelpCircle, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Role = "operator" | "manager" | "admin";

export default function Login() {
  const { login } = useAuth();
  const [tab, setTab] = useState<Role>("operator");
  const [loginInput, setLoginInput] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const loginMutation = useMutation({
    mutationFn: () => api.auth.login(loginInput.trim(), password),
    onSuccess: (data) => login(data.token, data.user),
    onError: (e: Error) => toast(e.message, "error"),
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginInput.trim() || !password) {
      toast("Введите имя/email и пароль", "error");
      return;
    }
    loginMutation.mutate();
  };

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
          <p className="text-gray-500 text-sm mt-1">Выберите роль и введите данные</p>
        </div>

        {/* Role tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(["operator", "manager", "admin"] as Role[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setLoginInput(""); setPassword(""); }}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${
                tab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "operator" ? "Оператор" : t === "manager" ? "Менеджер" : "Админ"}
            </button>
          ))}
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {tab === "admin" ? "Email или имя" : "Имя или email"}
            </label>
            <input
              type="text"
              value={loginInput}
              onChange={e => setLoginInput(e.target.value)}
              placeholder={
                tab === "admin" ? "Администратор"
                : tab === "manager" ? "Умид Хасанов"
                : "Ваше имя"
              }
              className="input"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5">
              {tab === "admin" && <ShieldCheck className="w-4 h-4 text-red-500" />}
              Пароль
            </label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Введите пароль"
                className="input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={!loginInput.trim() || !password || loginMutation.isPending}
            className="btn-primary w-full"
          >
            {loginMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Войти
          </button>
        </form>

        {/* Forgot password */}
        <div className="text-center">
          <button
            onClick={() => setShowHelp(true)}
            className="text-sm text-indigo-500 hover:text-indigo-700 transition-colors flex items-center gap-1 mx-auto"
          >
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
              <button onClick={() => setShowHelp(false)} className="btn-ghost">
                <X className="w-4 h-4" />
              </button>
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
              <button onClick={() => setShowHelp(false)} className="btn-primary w-full">
                Понятно
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
