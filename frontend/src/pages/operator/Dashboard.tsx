import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { currentMonth, formatMonth } from "@/lib/utils";
import { Trophy, TrendingUp, AlertCircle, Building2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const COLORS = ["hsl(237 73% 61%)", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export default function OperatorDashboard() {
  const { user } = useAuth();
  const month = currentMonth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["operator-dashboard", user?.id, month],
    queryFn: () => api.operator.dashboard(month),
    enabled: !!user,
  });

  if (isLoading) return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-100 rounded w-72" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-32 bg-gray-100 rounded-xl" />)}
      </div>
      <div className="h-80 bg-gray-100 rounded-xl" />
    </div>
  );

  if (error || !data) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <AlertCircle className="w-12 h-12 text-red-400" />
      <p className="text-gray-500">Ошибка загрузки. Обновите страницу.</p>
    </div>
  );

  const kpisWithTarget = data.kpis.filter(k => k.target > 0);
  const avgPercent = kpisWithTarget.length > 0
    ? Math.round(kpisWithTarget.reduce((s, k) => s + k.percent, 0) / kpisWithTarget.length)
    : 0;

  return (
    <div className="space-y-8 animate-in">
      <div>
        <h1 className="text-3xl font-bold">Привет, {data.operator.name} 👋</h1>
        <div className="flex items-center gap-3 mt-1 text-gray-500 text-sm">
          <span>{formatMonth(month)}</span>
          {data.branch && (
            <span className="flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" />
              {data.branch.name}
            </span>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      {data.kpis.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <p>Менеджер ещё не выставил планы на этот месяц.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.kpis.map((kpi, i) => {
            const color = COLORS[i % COLORS.length];
            const pct = Math.min(kpi.percent, 100);
            return (
              <div key={kpi.category.id} className="card p-5 shadow-sm hover:shadow-md transition-shadow"
                style={{ borderLeft: `4px solid ${color}` }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-500">{kpi.category.name}</span>
                  <span className="text-xs text-gray-400">{kpi.category.unit}</span>
                </div>
                <div className="text-2xl font-bold mb-1">{kpi.actual.toLocaleString()}</div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="progress-bar flex-1">
                    <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <span className="text-xs font-medium text-gray-500 w-10 text-right">{kpi.percent}%</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Цель: {kpi.target.toLocaleString()}</span>
                  {kpi.target > 0 && kpi.neededPerDay > 0 && (
                    <span>{kpi.neededPerDay} {kpi.category.unit}/день</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Summary card */}
          <div className="card p-5 shadow-sm bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">Общий результат</span>
              <Trophy className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold mb-1">{avgPercent}%</div>
            <p className="text-xs text-gray-400">
              Место #{data.teamRank} из {data.teamSize} операторов
            </p>
            <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-500">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Осталось {data.daysLeft} дн. в месяце</span>
            </div>
          </div>
        </div>
      )}

      {/* Chart — pick the first KPI with daily entries */}
      {data.kpis.length > 0 && (() => {
        const firstKpi = data.kpis.find(k => k.dailyEntries.length > 0);
        if (!firstKpi) return null;
        const chartData = firstKpi.dailyEntries.map(e => ({
          date: e.date,
          value: e.value,
        }));
        return (
          <div className="card p-6 shadow-sm">
            <h2 className="font-semibold mb-1">{firstKpi.category.name} — динамика</h2>
            <p className="text-sm text-gray-400 mb-4">Ежедневные продажи за {formatMonth(month)}</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" tickFormatter={v => format(new Date(v + "T12:00:00"), "d MMM", { locale: ru })}
                    tick={{ fontSize: 12, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: 13 }}
                    labelFormatter={v => format(new Date(v + "T12:00:00"), "d MMMM", { locale: ru })}
                  />
                  <Bar dataKey="value" name={firstKpi.category.name} fill={COLORS[0]} radius={[4,4,0,0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
