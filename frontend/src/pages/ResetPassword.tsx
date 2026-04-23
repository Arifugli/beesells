import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Signal, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token") || "";
    setToken(t);
  }, []);

  const mutation = useMutation({
    mutationFn: () => api.auth.resetPassword(token, password),
    onSuccess: () => setDone(true),
    onError: (e: Error) => toast(e.message, "error"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast("Минимум 6 символов", "error"); return; }
    if (password !== confirm) { toast("Пароли не совпадают", "error"); return; }
    mutation.mutate();
  };

  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      <div className="mb-8 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ background: "hsl(var(--primary))" }}>
          <Signal className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">TelecomSales</h1>
      </div>

      <div className="card w-full max-w-md shadow-xl p-8 space-y-6">
        {done ? (
          <div className="text-center space-y-4">
            <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
            <h2 className="text-xl font-bold">Пароль изменён!</h2>
            <p className="text-gray-500 text-sm">Теперь вы можете войти с новым паролем.</p>
            <a href={base + "/"} className="btn-primary w-full inline-flex items-center justify-center">
              Перейти к входу
            </a>
          </div>
        ) : !token ? (
          <div className="text-center space-y-3">
            <p className="text-red-500 font-medium">Недействительная ссылка</p>
            <a href={base + "/"} className="btn-outline w-full inline-flex items-center justify-center">Назад</a>
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-2xl font-bold">Новый пароль</h2>
              <p className="text-gray-500 text-sm mt-1">Введите новый пароль для вашего аккаунта.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Новый пароль</label>
                <div className="relative">
                  <input type={showPwd ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Минимум 6 символов" className="input pr-10" autoFocus />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Повторите пароль</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="Повторите пароль" className="input" />
              </div>
              <button type="submit" disabled={!password || !confirm || mutation.isPending} className="btn-primary w-full">
                {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Сохранить пароль
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
