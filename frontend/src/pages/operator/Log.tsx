import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { currentMonth } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Save, Loader2, CreditCard, Wifi } from "lucide-react";

const KPI_COLORS = ["hsl(237 73% 61%)", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function formatPrice(p: number) {
  return p.toLocaleString("ru-RU") + " сум";
}

export default function OperatorLog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const month = currentMonth();

  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [kpiValues, setKpiValues] = useState<Record<number, string>>({});
  const [tariffValues, setTariffValues] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState<"kpi" | "tariffs">("kpi");

  const { data: dashboard } = useQuery({
    queryKey: ["operator-dashboard", user?.id, month],
    queryFn: () => api.operator.dashboard(month),
    enabled: !!user,
  });

  const kpiMutation = useMutation({
    mutationFn: (entries: { categoryId: number; date: string; value: number }[]) =>
      Promise.all(entries.map(e => api.operator.logEntry(e))),
    onSuccess: () => {
      toast("KPI успешно записаны!", "success");
      setKpiValues({});
      queryClient.invalidateQueries({ queryKey: ["operator-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["archive-months"] });
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const tariffMutation = useMutation({
    mutationFn: (entries: { tariffId: number; date: string; quantity: number }[]) =>
      Promise.all(entries.map(e => api.operator.logTariffSale(e))),
    onSuccess: () => {
      toast("Тарифы успешно записаны!", "success");
      setTariffValues({});
      queryClient.invalidateQueries({ queryKey: ["operator-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["archive-months"] });
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const handleKpiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entries = Object.entries(kpiValues)
      .filter(([, v]) => v !== "" && !isNaN(Number(v)))
      .map(([catId, v]) => ({ categoryId: Number(catId), date, value: Number(v) }));
    if (entries.length === 0) { toast("Введите хотя бы одно значение", "error"); return; }
    kpiMutation.mutate(entries);
  };

  const handleTariffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entries = Object.entries(tariffValues)
      .filter(([, v]) => v !== "" && !isNaN(Number(v)) && Number(v) > 0)
      .map(([tariffId, v]) => ({ tariffId: Number(tariffId), date, quantity: Number(v) }));
    if (entries.length === 0) { toast("Введите количество хотя бы для одного тарифа", "error"); return; }
    tariffMutation.mutate(entries);
  };

  const categories = dashboard?.kpis ?? [];
  const tariffs = dashboard?.tariffStats ?? [];

  const dateLabel = format(new Date(date + "T12:00:00"), "d MMMM yyyy", { locale: ru });

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in">
      <div>
        <h1 className="text-3xl font-bold">Записать продажи</h1>
        <p className="text-gray-500 mt-1 text-sm">Введите показатели за выбранный день.</p>
      </div>

      {/* Date picker */}
      <div className="card p-4 shadow-sm">
        <label className="text-sm font-medium block mb-1.5">Дата</label>
        <input type="date" value={date} max={format(new Date(), "yyyy-MM-dd")}
          onChange={e => setDate(e.target.value)} className="input" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
        <button onClick={() => setActiveTab("kpi")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "kpi" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>
          <CreditCard className="w-4 h-4" />KPI показатели
        </button>
        <button onClick={() => setActiveTab("tariffs")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "tariffs" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>
          <Wifi className="w-4 h-4" />Тарифы
        </button>
      </div>

      {/* KPI Tab */}
      {activeTab === "kpi" && (
        <form onSubmit={handleKpiSubmit} className="card p-6 shadow-md space-y-5">
          {categories.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">Планы на этот месяц ещё не выставлены.</p>
          ) : (
            <div className="space-y-4">
              {categories.map((kpi, i) => {
                const color = KPI_COLORS[i % KPI_COLORS.length];
                return (
                  <div key={kpi.category.id} className="space-y-1.5">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                      {kpi.category.name}
                      <span className="text-gray-400 font-normal">({kpi.category.unit})</span>
                      {kpi.target > 0 && (
                        <span className="ml-auto text-xs text-gray-400">{kpi.actual} / {kpi.target} ({kpi.percent}%)</span>
                      )}
                    </label>
                    <input type="number" min="0" placeholder="0"
                      value={kpiValues[kpi.category.id] ?? ""}
                      onChange={e => setKpiValues(p => ({ ...p, [kpi.category.id]: e.target.value }))}
                      className="input text-lg font-semibold h-12" />
                  </div>
                );
              })}
            </div>
          )}

          {Object.values(kpiValues).some(v => v !== "") && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="font-medium text-gray-500 mb-1.5">Запись за {dateLabel}</p>
              {categories.filter(k => kpiValues[k.category.id]).map(k => (
                <div key={k.category.id} className="flex justify-between text-sm">
                  <span className="text-gray-600">{k.category.name}</span>
                  <span className="font-semibold">{kpiValues[k.category.id]} {k.category.unit}</span>
                </div>
              ))}
            </div>
          )}

          <button type="submit" disabled={kpiMutation.isPending || categories.length === 0} className="btn-primary w-full h-11">
            {kpiMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Сохраняем...</> : <><Save className="w-4 h-4" />Сохранить KPI</>}
          </button>
        </form>
      )}

      {/* Tariffs Tab */}
      {activeTab === "tariffs" && (
        <form onSubmit={handleTariffSubmit} className="card p-6 shadow-md space-y-5">
          {tariffs.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">Тарифы не созданы. Обратитесь к администратору.</p>
          ) : (
            <div className="space-y-4">
              {tariffs.map((ts) => (
                <div key={ts.tariff.id} className="space-y-1.5">
                  <label className="flex items-center justify-between text-sm font-medium">
                    <span className="flex items-center gap-2">
                      <Wifi className="w-3.5 h-3.5 text-indigo-500" />
                      {ts.tariff.name}
                    </span>
                    <span className="text-xs text-gray-400 font-normal">{formatPrice(ts.tariff.price)}/шт</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input type="number" min="0" placeholder="0 подключений"
                      value={tariffValues[ts.tariff.id] ?? ""}
                      onChange={e => setTariffValues(p => ({ ...p, [ts.tariff.id]: e.target.value }))}
                      className="input text-lg font-semibold h-12 flex-1" />
                    {tariffValues[ts.tariff.id] && Number(tariffValues[ts.tariff.id]) > 0 && (
                      <div className="text-right shrink-0">
                        <p className="text-xs text-gray-400">Выручка</p>
                        <p className="text-sm font-semibold text-emerald-600">
                          {formatPrice(Number(tariffValues[ts.tariff.id]) * ts.tariff.price)}
                        </p>
                      </div>
                    )}
                  </div>
                  {ts.target > 0 && (
                    <p className="text-xs text-gray-400">План: {ts.target} шт · Выполнено: {ts.quantity} шт ({ts.percent}%)</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {Object.values(tariffValues).some(v => v !== "" && Number(v) > 0) && (
            <div className="bg-emerald-50 rounded-lg p-3 text-sm">
              <p className="font-medium text-gray-600 mb-1.5">Запись за {dateLabel}</p>
              {tariffs.filter(ts => tariffValues[ts.tariff.id] && Number(tariffValues[ts.tariff.id]) > 0).map(ts => (
                <div key={ts.tariff.id} className="flex justify-between">
                  <span className="text-gray-600">{ts.tariff.name}</span>
                  <span className="font-semibold">{tariffValues[ts.tariff.id]} шт = {formatPrice(Number(tariffValues[ts.tariff.id]) * ts.tariff.price)}</span>
                </div>
              ))}
              <div className="flex justify-between mt-2 pt-2 border-t border-emerald-200 font-bold text-emerald-700">
                <span>Итого выручка:</span>
                <span>{formatPrice(
                  tariffs.filter(ts => tariffValues[ts.tariff.id]).reduce((s, ts) => s + Number(tariffValues[ts.tariff.id] || 0) * ts.tariff.price, 0)
                )}</span>
              </div>
            </div>
          )}

          <button type="submit" disabled={tariffMutation.isPending || tariffs.length === 0} className="btn-primary w-full h-11">
            {tariffMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Сохраняем...</> : <><Save className="w-4 h-4" />Сохранить тарифы</>}
          </button>
        </form>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <p className="font-medium mb-1">💡 Подсказка</p>
        <p>Можно записывать несколько раз в день — последняя запись заменит предыдущую.</p>
      </div>
    </div>
  );
}
