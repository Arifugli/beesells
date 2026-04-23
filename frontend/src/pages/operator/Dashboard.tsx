import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { currentMonth, formatMonth, prevMonth } from "@/lib/utils";
import { Trophy, TrendingUp, AlertCircle, Building2, GitCompare } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { ComparisonBadge } from "@/components/ui/ComparisonBadge";

const COLORS = ["hsl(237 73% 61%)", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export default function OperatorDashboard() {
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonth());
  const [compareMode, setCompareMode] = useState(false);
  const [compareWith, setCompareWith] = useState<string>(prevMonth(currentMonth()));

  const { data, isLoading, error } = useQuery({
    queryKey: ["operator-dashboard", user?.id, month],
    queryFn: () => api.operator.dashboard(month),
    enabled: !!user,
  });

  // Comparison data (only fetched when compare mode is on)
  const { data: compareData } = useQuery({
    queryKey: ["operator-dashboard", user?.id, compareWith],
    queryFn: () => api.operator.dashboard(compareWith),
    enabled: !!user && compareMode,
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

  const compareAvg = compareData
    ? (() => {
        const ks = compareData.kpis.filter(k => k.target > 0);
        return ks.length > 0 ? Math.round(ks.reduce((s, k) => s + k.percent, 0) / ks.length) : 0;
      })()
    : 0;

  const getPrevKpi = (categoryId: number) =>
    compareData?.kpis.find(k => k.category.id === categoryId);

  const isCurrentMonth = month === currentMonth();

  return (
    <div className="space-y-6 animate-in">
      {/* Header with month picker */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Привет, {data.operator.name} 👋</h1>
          <div className="flex items-center gap-3 mt-1 text-gray-500 text-sm capitalize">
            <span>{formatMonth(month)}</span>
            {data.branch && (
              <span className="flex items-center gap-1 normal-case">
                <Building2 className="w-3.5 h-3.5" />
                {data.branch.name}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <MonthPicker value={month} onChange={setMonth} />
          <button
            onClick={() => {
              if (!compareMode) setCompareWith(prevMonth(month));
              setCompareMode(!compareMode);
            }}
            className={`h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border text-sm font-medium transition-all ${
              compareMode
                ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <GitCompare className="w-4 h-4" />
            Сравнение
          </button>
          {compareMode && (
            <MonthPicker value={compareWith} onChange={setCompareWith} />
          )}
        </div>
      </div>

      {/* KPI Cards */}
      {data.kpis.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <p>{isCurrentMonth ? "Менеджер ещё не выставил планы на этот месяц." : "Нет данных за этот месяц."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.kpis.map((kpi, i) => {
            const color = COLORS[i % COLORS.length];
            const pct = Math.min(kpi.percent, 100);
            const prev = getPrevKpi(kpi.category.id);
            return (
              <div key={kpi.category.id} className="card p-5 shadow-sm hover:shadow-md transition-shadow"
                style={{ borderLeft: `4px solid ${color}` }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-500">{kpi.category.name}</span>
                  <span className="text-xs text-gray-400">{kpi.category.unit}</span>
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <div className="text-2xl font-bold">{kpi.actual.toLocaleString()}</div>
                  {compareMode && prev && (
                    <ComparisonBadge current={kpi.actual} previous={prev.actual} absolute />
                  )}
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="progress-bar flex-1">
                    <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <span className="text-xs font-medium text-gray-500 w-10 text-right">{kpi.percent}%</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Цель: {kpi.target.toLocaleString()}</span>
                  {isCurrentMonth && kpi.target > 0 && kpi.neededPerDay > 0 && (
                    <span>{kpi.neededPerDay} {kpi.category.unit}/день</span>
                  )}
                </div>
                {compareMode && prev && (
                  <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-100 text-xs text-gray-400 capitalize">
                    <span>{formatMonth(compareWith)}:</span>
                    <span className="font-medium text-gray-600">{prev.actual.toLocaleString()}</span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Summary card */}
          <div className="card p-5 shadow-sm bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">Общий результат</span>
              <Trophy className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <div className="text-2xl font-bold">{avgPercent}%</div>
              {compareMode && compareData && (
                <ComparisonBadge current={avgPercent} previous={compareAvg} />
              )}
            </div>
            <p className="text-xs text-gray-400">
              Место #{data.teamRank} из {data.teamSize} операторов
            </p>
            {isCurrentMonth ? (
              <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-500">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Осталось {data.daysLeft} дн. в месяце</span>
              </div>
            ) : compareMode && compareData && (
              <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-400 capitalize">
                <span>{formatMonth(compareWith)}: {compareAvg}%</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tariff Stats */}
      {data.tariffStats && data.tariffStats.length > 0 && (
        <div className="card p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">Выручка по тарифам</h2>
              <p className="text-sm text-gray-400 mt-0.5 capitalize">{formatMonth(month)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Общая выручка</p>
              <p className="text-xl font-bold text-emerald-600">{data.totalRevenue.toLocaleString("ru-RU")} сум</p>
            </div>
          </div>
          <div className="space-y-3">
            {data.tariffStats.map((ts, i) => (
              <div key={ts.tariff.id} className="flex items-center gap-4 py-2 border-b border-gray-100 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{ts.tariff.name}</span>
                    <span className="text-sm font-bold text-emerald-600">{ts.revenue.toLocaleString("ru-RU")} сум</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{ts.quantity} шт × {ts.tariff.price.toLocaleString("ru-RU")} сум</span>
                    {ts.target > 0 && (
                      <>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-400">План: {ts.target} шт ({ts.percent}%)</span>
                      </>
                    )}
                  </div>
                  {ts.target > 0 && (
                    <div className="progress-bar mt-1.5">
                      <div className="progress-fill" style={{ width: `${Math.min(ts.percent, 100)}%`, background: COLORS[i % COLORS.length] }} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chart */}
      {data.kpis.length > 0 && (() => {
        const firstKpi = data.kpis.find(k => k.dailyEntries.length > 0);
        if (!firstKpi) return null;
        const chartData = firstKpi.dailyEntries.map(e => ({ date: e.date, value: e.value }));
        return (
          <div className="card p-6 shadow-sm">
            <h2 className="font-semibold mb-1">{firstKpi.category.name} — динамика</h2>
            <p className="text-sm text-gray-400 mb-4 capitalize">Ежедневные показатели за {formatMonth(month)}</p>
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
