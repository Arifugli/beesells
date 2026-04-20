import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { api } from "@/lib/api";
import { formatMonth } from "@/lib/utils";
import {
  Users, Smartphone, CreditCard, AlertTriangle, TrendingUp, Medal
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";

function KpiCard({
  label, value, target, percent, color, icon: Icon, highlight,
}: {
  label: string; value: number; target?: number; percent?: number;
  color: string; icon: React.ElementType; highlight?: boolean;
}) {
  return (
    <div className={`bg-card border border-border rounded-xl p-5 shadow-sm ${highlight ? "border-l-4 border-l-destructive" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: color + "20" }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <div className={`text-2xl font-bold ${highlight ? "text-destructive" : ""}`}>{value}</div>
      {target !== undefined && percent !== undefined && (
        <>
          <div className="flex justify-between text-xs text-muted-foreground mt-2 mb-1">
            <span>Цель: {target}</span>
            <span className="font-medium text-foreground">{percent}%</span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color }}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default function ManagerDashboard() {
  const currentMonth = format(new Date(), "yyyy-MM");

  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ["dashboard", "manager", currentMonth],
    queryFn: () => api.dashboard.manager(currentMonth),
  });

  const { data: activity, isLoading: actLoading } = useQuery({
    queryKey: ["dashboard", "team-activity", currentMonth],
    queryFn: () => api.dashboard.teamActivity(currentMonth),
  });

  const isLoading = dashLoading || actLoading;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-secondary rounded w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-secondary rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-96 bg-secondary rounded-xl lg:col-span-2" />
          <div className="h-96 bg-secondary rounded-xl" />
        </div>
      </div>
    );
  }

  if (!dashboard) return null;

  const simOverall = dashboard.totalSimTarget > 0
    ? Math.round((dashboard.totalSim / dashboard.totalSimTarget) * 100) : 0;
  const devOverall = dashboard.totalDeviceTarget > 0
    ? Math.round((dashboard.totalDevices / dashboard.totalDeviceTarget) * 100) : 0;

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Обзор команды</h1>
          <p className="text-muted-foreground mt-1">
            Показатели за {formatMonth(currentMonth)}
          </p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="SIM-карты (всего)"
          value={dashboard.totalSim}
          target={dashboard.totalSimTarget}
          percent={simOverall}
          color="hsl(237 73% 61%)"
          icon={CreditCard}
        />
        <KpiCard
          label="Устройства (всего)"
          value={dashboard.totalDevices}
          target={dashboard.totalDeviceTarget}
          percent={devOverall}
          color="#10b981"
          icon={Smartphone}
        />
        <KpiCard
          label="Активные операторы"
          value={dashboard.operatorsCount}
          color="#f59e0b"
          icon={Users}
        />
        <KpiCard
          label="Отстают от плана"
          value={dashboard.behindCount}
          color="#ef4444"
          icon={AlertTriangle}
          highlight
        />
      </div>

      {/* Chart + Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Area chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Активность команды</h2>
            <p className="text-sm text-muted-foreground">Нарастающий итог продаж за месяц</p>
          </div>
          <div className="h-72 w-full">
            {activity && activity.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSim" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(237 73% 61%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(237 73% 61%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorDev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => format(new Date(v + "T12:00:00"), "d MMM")}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--card))",
                      color: "hsl(var(--card-foreground))",
                    }}
                    labelFormatter={(v) => format(new Date(v + "T12:00:00"), "d MMMM yyyy")}
                  />
                  <Area type="monotone" dataKey="cumSim" name="SIM (нараст.)" stroke="hsl(237 73% 61%)" strokeWidth={2} fillOpacity={1} fill="url(#colorSim)" />
                  <Area type="monotone" dataKey="cumDev" name="Устройства (нараст.)" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorDev)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p>Нет данных за этот месяц</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="text-lg font-semibold">Рейтинг операторов</h2>
            <p className="text-sm text-muted-foreground">По среднему % выполнения плана</p>
          </div>
          <div className="divide-y divide-border">
            {dashboard.operators.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                Нет данных
              </div>
            ) : (
              dashboard.operators.map((op) => {
                const avg = Math.round((op.simPercent + op.devicePercent) / 2);
                const isBehind = avg < 65;
                const rankIcon = op.rank === 1 ? "🥇" : op.rank === 2 ? "🥈" : op.rank === 3 ? "🥉" : null;

                return (
                  <div
                    key={op.operator.id}
                    className={`flex items-center gap-3 px-5 py-3.5 ${isBehind ? "bg-destructive/5" : ""}`}
                  >
                    <div className="w-7 text-center text-sm font-bold text-muted-foreground">
                      {rankIcon ?? op.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{op.operator.name}</span>
                        {isBehind && <AlertTriangle className="w-3 h-3 text-destructive shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(avg, 100)}%`,
                              backgroundColor: isBehind ? "#ef4444" : "hsl(237 73% 61%)",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${isBehind ? "text-destructive" : "text-foreground"}`}>
                      {avg}%
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
