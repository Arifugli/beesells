import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { Signal, Loader2, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Tab = "operator" | "manager" | "admin";

export default function Login() {
  const { login } = useAuth();
  const [tab, setTab] = useState<Tab>("operator");
  const [selectedId, setSelectedId] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const { data: operators = [], isLoading: opsLoading } = useQuery({
    queryKey: ["auth-users", "operator"],
    queryFn: () => api.auth.users("operator"),
  });

  const { data: managers = [], isLoading: mgrLoading } = useQuery({
    queryKey: ["auth-users", "manager"],
    queryFn: () => api.auth.users("manager"),
  });

  const selectMutation = useMutation({
    mutationFn: (userId: number) => api.auth.loginSelect(userId),
    onSuccess: (data) => login(data.token, data.user),
    onError: (e: Error) => toast(e.message, "error"),
  });

  const adminMutation = useMutation({
    mutationFn: (pwd: string) => api.auth.loginAdmin(pwd),
    onSuccess: (data) => login(data.token, data.user),
    onError: () => toast("Неверный пароль", "error"),
  });

  const users = tab === "operator" ? operators : managers;
  const isLoading = tab === "operator" ? opsLoading : mgrLoading;

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
          <p className="text-gray-500 text-sm mt-1">Выберите роль для входа</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(["operator", "manager", "admin"] as Tab[]).map(t => (
            <button key={t} onClick={() => { setTab(t); setSelectedId(""); }}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${
                tab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}>
              {t === "operator" ? "Оператор" : t === "manager" ? "Менеджер" : "Админ"}
            </button>
          ))}
        </div>

        {/* Operator / Manager select */}
        {tab !== "admin" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Выберите {tab === "operator" ? "оператора" : "менеджера"}</label>
              <select
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                disabled={isLoading}
                className="select"
              >
                <option value="">{isLoading ? "Загрузка..." : "— выберите —"}</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <button
              onClick={() => selectedId && selectMutation.mutate(Number(selectedId))}
              disabled={!selectedId || selectMutation.isPending}
              className="btn-primary w-full"
            >
              {selectMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Войти
            </button>
          </div>
        )}

        {/* Admin password */}
        {tab === "admin" && (
          <div className="space-y-4">
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
                  onKeyDown={e => e.key === "Enter" && password && adminMutation.mutate(password)}
                  placeholder="Введите пароль"
                  className="input pr-10"
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              onClick={() => password && adminMutation.mutate(password)}
              disabled={!password || adminMutation.isPending}
              className="btn-primary w-full"
            >
              {adminMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Войти как администратор
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
