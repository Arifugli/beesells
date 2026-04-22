import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { currentMonth } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Save, Loader2 } from "lucide-react";

const COLORS = ["hsl(237 73% 61%)", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export default function OperatorLog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const month = currentMonth();

  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [values, setValues] = useState<Record<number, string>>({});

  const { data: dashboard } = useQuery({
    queryKey: ["operator-dashboard", user?.id, month],
    queryFn: () => api.operator.dashboard(month),
    enabled: !!user,
  });

  const mutation = useMutation({
    mutationFn: (entries: { categoryId: number; date: string; value: number }[]) =>
      Promise.all(entries.map(e => api.operator.logEntry(e))),
    onSuccess: () => {
      toast("KPI успешно записаны!", "success");
      setValues({});
      queryClient.invalidateQueries({ queryKey: ["operator-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["archive-months"] });
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entries = Object.entries(values)
      .filter(([, v]) => v !== "" && !isNaN(Number(v)))
      .map(([catId, v]) => ({ categoryId: Number(catId), date, value: Number(v) }));
    if (entries.length === 0) { toast("Введите хотя бы одно значение", "error"); return; }
    mutation.mutate(entries);
  };

  const categories = dashboard?.kpis ?? [];

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in">
      <div>
        <h1 className="text-3xl font-bold">Записать KPI</h1>
        <p className="text-gray-500 mt-1 text-sm">Введите показатели за выбранный день.</p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 shadow-md space-y-6">
        {/* Date */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Дата</label>
          <input type="date" value={date} max={format(new Date(), "yyyy-MM-dd")}
            onChange={e => setDate(e.target.value)} className="input" />
        </div>

        {/* KPI inputs */}
        {categories.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">Планы на этот месяц ещё не выставлены.</p>
        ) : (
          <div className="space-y-4">
            {categories.map((kpi, i) => {
              const color = COLORS[i % COLORS.length];
              return (
                <div key={kpi.category.id} className="space-y-1.5">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                    {kpi.category.name}
                    <span className="text-gray-400 font-normal">({kpi.category.unit})</span>
                    {kpi.target > 0 && (
                      <span className="ml-auto text-xs text-gray-400">
                        {kpi.actual} / {kpi.target} ({kpi.percent}%)
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={values[kpi.category.id] ?? ""}
                    onChange={e => setValues(p => ({ ...p, [kpi.category.id]: e.target.value }))}
                    className="input text-lg font-semibold h-12"
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Preview */}
        {Object.values(values).some(v => v !== "") && (
          <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
            <p className="font-medium text-gray-500 mb-2">Запись за {format(new Date(date + "T12:00:00"), "d MMMM yyyy", { locale: ru })}</p>
            {categories.filter(k => values[k.category.id]).map(k => (
              <div key={k.category.id} className="flex justify-between">
                <span className="text-gray-600">{k.category.name}</span>
                <span className="font-semibold">{values[k.category.id]} {k.category.unit}</span>
              </div>
            ))}
          </div>
        )}

        <button type="submit" disabled={mutation.isPending || categories.length === 0} className="btn-primary w-full h-11">
          {mutation.isPending
            ? <><Loader2 className="w-4 h-4 animate-spin" />Сохраняем...</>
            : <><Save className="w-4 h-4" />Сохранить KPI</>
          }
        </button>
      </form>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <p className="font-medium mb-1">💡 Подсказка</p>
        <p>Можно записывать несколько раз в день — последняя запись заменит предыдущую.</p>
      </div>
    </div>
  );
}
