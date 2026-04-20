import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { Signal, User, Loader2 } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");

  const { data: operators, isLoading } = useQuery({
    queryKey: ["operators"],
    queryFn: api.operators.list,
  });

  const operatorList = operators?.filter((o) => o.role === "operator") ?? [];

  const handleOperatorLogin = () => {
    if (!selectedId) { setError("Выберите оператора"); return; }
    const op = operatorList.find((o) => o.id === Number(selectedId));
    if (op) login({ id: op.id, role: "operator", name: op.name });
  };

  const handleManagerLogin = () => {
    const mgr = operators?.find((o) => o.role === "manager");
    if (mgr) {
      login({ id: mgr.id, role: "manager", name: mgr.name });
    } else {
      login({ id: 0, role: "manager", name: "Менеджер" });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-3">
        <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
          <Signal className="w-6 h-6 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">TelecomSales</h1>
      </div>

      <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-xl p-8 space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold">Добро пожаловать</h2>
          <p className="text-muted-foreground text-sm">Выберите профиль для входа</p>
        </div>

        {/* Operator login */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Вход как оператор</label>
          <div className="flex gap-2">
            <select
              value={selectedId}
              onChange={(e) => { setSelectedId(e.target.value); setError(""); }}
              disabled={isLoading}
              className="flex-1 h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              <option value="">
                {isLoading ? "Загрузка..." : "Выберите имя"}
              </option>
              {operatorList.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleOperatorLogin}
              disabled={!selectedId || isLoading}
              className="px-4 h-10 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Войти
            </button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">или</span>
          </div>
        </div>

        {/* Manager login */}
        <button
          onClick={handleManagerLogin}
          disabled={isLoading}
          className="w-full h-10 flex items-center justify-center gap-2 border border-border rounded-md text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <User className="w-4 h-4" />
          )}
          Войти как менеджер
        </button>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        TelecomSales Dashboard v1.0
      </p>
    </div>
  );
}
