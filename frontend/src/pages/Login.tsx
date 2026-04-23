import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { Signal, Loader2, ShieldCheck, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Screen = "login" | "forgot" | "forgot-sent";
type Role = "operator" | "manager" | "admin";

export default function Login() {
  const { login } = useAuth();
  const [screen, setScreen] = useState<Screen>("login");
  const [tab, setTab] = useState<Role>("operator");
  const [loginInput, setLoginInput] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [forgotInput, setForgotInput] = useState("");

  const loginMutation = useMutation({
    mutationFn: () => api.auth.login(loginInput.trim(), password),
    onSuccess: (data) => login(data.token, data.user),
    onError: (e: Error) => toast(e.message, "error"),
  });

  const forgotMutation = useMutation({
    mutationFn: () => api.auth.forgotPassword(forgotInput.trim()),
    onSuccess: () => setScreen("forgot-sent"),
    onError: (e: Error) => toast(e.message, "error"),
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginInput.trim() || !password) { toast("Введите имя/email и пароль", "error"); return; }
    loginMutation.mutate();
  };

  if (screen === "forgot" || screen === "forgot-sent") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
        <div className="mb-8 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ background: "hsl(var(--primary))" }}>
            <Signal className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">TelecomSales</h1>
        </div>

        <div className="card w-full max-w-md shadow-xl p-8 space-y-6">
          <button onClick={() => setScreen("login")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeft className="w-4 h-4" />Назад
          </button>

          {screen === "forgot-sent" ? (
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <span className="text-2xl">📧</span>
              </div>
              <h2 className="text-xl font-bold">Письмо отправлено</h2>
              <p className="text-gray-500 text-sm">Если аккаунт с таким email существует, вы получите письмо со ссылкой для сброса пароля.</p>
              <button onClick={() => setScreen("login")} className="btn-primary w-full mt-4">
                Вернуться к входу
              </button>
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-2xl font-bold">Забыли пароль?</h2>
                <p className="text-gray-500 text-sm mt-1">Введите ваш email или имя — отправим ссылку для сброса.</p>
              </div>
              <form onSubmit={e => { e.preventDefault(); forgotMutation.mutate(); }} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Email или имя пользователя</label>
                  <input
                    type="text"
                    value={forgotInput}
                    onChange={e => setForgotInput(e.target.value)}
                    placeholder="email@company.com"
                    className="input"
                    autoFocus
                  />
                </div>
                <button type="submit" disabled={!forgotInput.trim() || forgotMutation.isPending} className="btn-primary w-full">
                  {forgotMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Отправить ссылку
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      <div className="mb-8 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ background: "hsl(var(--primary))" }}>
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
            <button key={t} onClick={() => { setTab(t); setLoginInput(""); setPassword(""); }}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${tab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
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
              placeholder={tab === "admin" ? "Администратор" : tab === "manager" ? "Умид Хасанов" : "Ваше имя"}
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
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={!loginInput.trim() || !password || loginMutation.isPending} className="btn-primary w-full">
            {loginMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Войти
          </button>
        </form>

        <div className="text-center">
          <button onClick={() => { setScreen("forgot"); setForgotInput(loginInput); }}
            className="text-sm text-indigo-500 hover:text-indigo-700 transition-colors">
            Забыли пароль?
          </button>
        </div>
      </div>
    </div>
  );
}
