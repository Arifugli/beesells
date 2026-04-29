import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { currentMonth, formatMonth, prevMonth } from "@/lib/utils";
import { AlertTriangle, Building2, Users, TrendingUp, GitCompare } from "lucide-react";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { ComparisonBadge } from "@/components/ui/ComparisonBadge";

const COLORS = ["hsl(237 73% 61%)", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function ManagerDashboard() {
  const [month, setMonth] = useState(currentMonth());
  const [compareMode, setCompareMode] = useState(false);
  const [compareWith, setCompareWith] = useState<string>(prevMonth(currentMonth()));

  const { data, isLoading } = useQuery({
    queryKey: ["manager-dashboard", month],
    queryFn: () => api.manager.dashboard(month),
  });

  const { data: compareData } = useQuery({
    queryKey: ["manager-dashboard", compareWith],
    queryFn: () => api.manager.dashboard(compareWith),
    enabled: compareMode,
  });

  if (isLoading) return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-100 rounded w-64" />
      <div className="grid grid-cols-3 gap-4">{[1,2,3].map(i => <div key={i} className="h-28 bg-gray-100 rounded-xl" />)}</div>
      <div className="h-80 bg-gray-100 rounded-xl" />
    </div>
  );

  if (!data) return null;

  const allOperators = data.branches.flatMap(b => b.operators);
  const totalOps = allOperators.length;
  const behindOps = allOperators.filter(o => o.avgPercent < 65).length;
  const avgTeam = totalOps > 0 ? Math.round(allOperators.reduce((s, o) => s + o.avgPercent, 0) / totalOps) : 0;

  const compareOps = compareData?.branches.flatMap(b => b.operators) ?? [];
  const compareBehind = compareOps.filter(o => o.avgPercent < 65).length;
  const compareAvg = compareOps.length > 0
    ? Math.round(compareOps.reduce((s, o) => s + o.avgPercent, 0) / compareOps.length) : 0;
  const compareOpMap = new Map(compareOps.map(o => [o.operator.id, o]));

  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Обзор команды</h1>
          <p className="text-gray-500 mt-1 text-sm capitalize">{formatMonth(month)}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <MonthPicker value={month} onChange={setMonth} />
          <button
            onClick={() => { if (!compareMode) setCompareWith(prevMonth(month)); setCompareMode(!compareMode); }}
            className={`h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border text-sm font-medium transition-all ${
              compareMode ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <GitCompare className="w-4 h-4" />Сравнение
          </button>
          {compareMode && <MonthPicker value={compareWith} onChange={setCompareWith} />}
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Операторов</span>
            <Users className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-bold">{totalOps}</div>
            {compareMode && compareData && <ComparisonBadge current={totalOps} previous={compareOps.length} absolute />}
          </div>
          <p className="text-xs text-gray-400 mt-1">в {data.branches.length} отд.</p>
        </div>
        <div className="card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Средний % выполнения</span>
            <TrendingUp className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-bold">{avgTeam}%</div>
            {compareMode && compareData && <ComparisonBadge current={avgTeam} previous={compareAvg} />}
          </div>
          <div className="progress-bar mt-2">
            <div className="progress-fill" style={{ width: `${Math.min(avgTeam,100)}%`, background: "hsl(var(--primary))" }} />
          </div>
          {compareMode && compareData && <p className="text-xs text-gray-400 mt-2 capitalize">{formatMonth(compareWith)}: {compareAvg}%</p>}
        </div>
        <div className="card p-5 shadow-sm" style={{ borderLeft: "4px solid hsl(var(--destructive))" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Отстают от плана</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-bold text-red-500">{behindOps}</div>
            {compareMode && compareData && <ComparisonBadge current={compareBehind} previous={behindOps} absolute />}
          </div>
          <p className="text-xs text-gray-400 mt-1">менее 65% выполнения</p>
        </div>
      </div>

      {/* Per-branch breakdown */}
      {data.branches.map(bs => {
        // Only show categories where at least one operator has a non-zero target
        const visibleCategories = data.categories.filter(cat =>
          bs.operators.some(op => {
            const kpi = op.kpis.find(k => k.category.id === cat.id);
            return kpi && kpi.target > 0;
          })
        );

        return (
          <div key={bs.branch.id} className="card shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-400" />
              <h2 className="font-semibold">{bs.branch.name}</h2>
              <span className="badge badge-muted ml-auto">{bs.operators.length} операторов</span>
            </div>

            {bs.operators.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-sm">Нет операторов</div>
            ) : (
              <div style={{ overflowX: visibleCategories.length > 3 ? "auto" : "visible" }}>
                <table className="table" style={{ minWidth: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>№</th>
                      <th style={{ minWidth: 140 }}>Оператор</th>
                      {visibleCategories.map(c => (
                        <th key={c.id} className="text-right" style={{ minWidth: 110, maxWidth: 160 }}>
                          <span className="block truncate" title={c.name}>{c.name}</span>
                        </th>
                      ))}
                      <th className="text-right" style={{ minWidth: 80 }}>Avg %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bs.operators.map(op => {
                      const behind = op.avgPercent < 65;
                      return (
                        <tr key={op.operator.id} className={behind ? "bg-red-50/50" : ""}>
                          <td className="text-gray-400 font-mono text-center text-sm">
                            {op.rank === 1 ? "🥇" : op.rank === 2 ? "🥈" : op.rank === 3 ? "🥉" : op.rank}
                          </td>
                          <td>
                            <span className="font-medium">{op.operator.name}</span>
                            {behind && <AlertTriangle className="inline w-3 h-3 text-red-400 ml-1" />}
                          </td>
                          {visibleCategories.map((c, ci) => {
                            const kpi = op.kpis.find(k => k.category.id === c.id);
                            return (
                              <td key={c.id} className="text-right">
                                {kpi && kpi.target > 0 ? (
                                  <div>
                                    <span className="font-medium text-sm">{kpi.actual}</span>
                                    <span className="text-gray-400 text-xs ml-1">/{kpi.target}</span>
                                    <div className="progress-bar mt-1" style={{ width: 64, marginLeft: "auto" }}>
                                      <div className="progress-fill" style={{ width: `${Math.min(kpi.percent,100)}%`, background: COLORS[ci % COLORS.length] }} />
                                    </div>
                                  </div>
                                ) : kpi ? (
                                  <span className="text-sm text-gray-500">{kpi.actual}</span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <span className={`font-bold text-sm ${behind ? "text-red-500" : "text-gray-900"}`}>
                                {op.avgPercent}%
                              </span>
                              {compareMode && compareOpMap.get(op.operator.id) && (
                                <ComparisonBadge
                                  current={op.avgPercent}
                                  previous={compareOpMap.get(op.operator.id)!.avgPercent}
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {data.branches.length === 0 && (
        <div className="card p-12 text-center text-gray-400">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>У вас пока нет отделений. Обратитесь к администратору.</p>
        </div>
      )}
    </div>
  );
}
