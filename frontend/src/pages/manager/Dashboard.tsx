import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { currentMonth, formatMonth } from "@/lib/utils";
import { AlertTriangle, Building2, Users, TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

const COLORS = ["hsl(237 73% 61%)", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function ManagerDashboard() {
  const month = currentMonth();

  const { data, isLoading } = useQuery({
    queryKey: ["manager-dashboard", month],
    queryFn: () => api.manager.dashboard(month),
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

  return (
    <div className="space-y-8 animate-in">
      <div>
        <h1 className="text-3xl font-bold">Обзор команды</h1>
        <p className="text-gray-500 mt-1 text-sm">{formatMonth(month)}</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Операторов</span>
            <Users className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-2xl font-bold">{totalOps}</div>
          <p className="text-xs text-gray-400 mt-1">в {data.branches.length} отд.</p>
        </div>
        <div className="card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Средний % выполнения</span>
            <TrendingUp className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-2xl font-bold">{avgTeam}%</div>
          <div className="progress-bar mt-2">
            <div className="progress-fill" style={{ width: `${Math.min(avgTeam,100)}%`, background: "hsl(var(--primary))" }} />
          </div>
        </div>
        <div className="card p-5 shadow-sm" style={{ borderLeft: "4px solid hsl(var(--destructive))" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Отстают от плана</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-red-500">{behindOps}</div>
          <p className="text-xs text-gray-400 mt-1">менее 65% выполнения</p>
        </div>
      </div>

      {/* Per-branch breakdown */}
      {data.branches.map(bs => (
        <div key={bs.branch.id} className="card shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-400" />
            <h2 className="font-semibold">{bs.branch.name}</h2>
            <span className="badge badge-muted ml-auto">{bs.operators.length} операторов</span>
          </div>

          {bs.operators.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm">Нет операторов</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th className="w-10">№</th>
                  <th>Оператор</th>
                  {data.categories.slice(0, 3).map(c => (
                    <th key={c.id} className="text-right">{c.name}</th>
                  ))}
                  <th className="text-right">Avg %</th>
                </tr>
              </thead>
              <tbody>
                {bs.operators.map(op => {
                  const behind = op.avgPercent < 65;
                  return (
                    <tr key={op.operator.id} className={behind ? "bg-red-50/50" : ""}>
                      <td className="text-gray-400 font-mono text-center">
                        {op.rank === 1 ? "🥇" : op.rank === 2 ? "🥈" : op.rank === 3 ? "🥉" : op.rank}
                      </td>
                      <td>
                        <span className="font-medium">{op.operator.name}</span>
                        {behind && <AlertTriangle className="inline w-3 h-3 text-red-400 ml-1.5" />}
                      </td>
                      {data.categories.slice(0, 3).map((c, ci) => {
                        const kpi = op.kpis.find(k => k.category.id === c.id);
                        return (
                          <td key={c.id} className="text-right">
                            {kpi ? (
                              <div>
                                <span className="font-medium">{kpi.actual}</span>
                                {kpi.target > 0 && <span className="text-gray-400 text-xs ml-1">/{kpi.target}</span>}
                                {kpi.target > 0 && (
                                  <div className="progress-bar mt-1 w-16 ml-auto">
                                    <div className="progress-fill" style={{ width: `${Math.min(kpi.percent,100)}%`, background: COLORS[ci] }} />
                                  </div>
                                )}
                              </div>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                        );
                      })}
                      <td className="text-right">
                        <span className={`font-bold ${behind ? "text-red-500" : "text-gray-900"}`}>
                          {op.avgPercent}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ))}

      {data.branches.length === 0 && (
        <div className="card p-12 text-center text-gray-400">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>У вас пока нет отделений. Обратитесь к администратору.</p>
        </div>
      )}
    </div>
  );
}
