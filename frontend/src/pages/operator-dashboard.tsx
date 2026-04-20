import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { formatMonth } from "@/lib/utils";
import {
  CreditCard, Smartphone, Trophy, TrendingUp,
  Calendar, AlertCircle
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

function StatCard({
  label, value, target, percent, color, icon: Icon,
}: {
  label: string; value: number; target: number; percent: number;
  color: string; icon: React.ElementType;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow"
      style={{ borderLeftColor: color, borderLeftWidth: 4 }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: color + "20" }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <div className="text-2xl font-bold mb-2">{value}</div>
      <div className="flex items-center gap-2 mb-1">
        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color }}
          />
        </div>
        <span className="text-xs font-medium text-muted-foreground w-10 text-right">{percent}%</span>
      </div>
      <p className="text-xs text-muted-foreground">Цель: {target}</p>
    </div>
  );
}

export default function OperatorDashboard() {
  const { user } = useAuth();
  const currentMonth = format(new Date(), "yyyy-MM");

  const { data: dashboard, isLoading, error } = useQuery({
    queryKey: ["dashboard", "operator", user?.id, currentMonth],
    queryFn: () => api.dashboard.operator(user!.id, currentMonth),
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-secondary rounded w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-secondary rounded-xl" />)}
        </div>
        <div className="h-80 bg-secondary rounded-xl" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <h2 className="text-xl font-semibold">Ошибка загрузки</h2>
        <p className="text-muted-foreground">Проверьте подключение к серверу и обновите страницу.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Привет, {dashboard.operator.name} 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          Ваши показатели за {formatMonth(currentMonth)}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="SIM-карты продано"
          value={dashboard.simSold}
          target={dashboard.simTarget}
          percent={dashboard.simPercent}
          color="hsl(237 73% 61%)"
          icon={CreditCard}
        />
        <StatCard
          label="Устройства продано"
          value={dashboard.devicesSold}
          target={dashboard.deviceTarget}
          percent={dashboard.devicePercent}
          color="#10b981"
          icon={Smartphone}
        />

        {/* Team rank */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Место в команде</span>
            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-amber-500" />
            </div>
          </div>
          <div className="text-2xl font-bold">
            #{dashboard.teamRank}
            <span className="text-sm font-normal text-muted-foreground ml-1">
              из {dashboard.totalOperators}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">По объёму продаж SIM</p>
        </div>

        {/* Pace needed */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Темп для выполнения</span>
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">SIM в день:</span>
              <span className="font-semibold">
                {dashboard.simNeededPerDay > 0 ? dashboard.simNeededPerDay : "✓"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Устройств в день:</span>
              <span className="font-semibold">
                {dashboard.deviceNeededPerDay > 0 ? dashboard.deviceNeededPerDay : "✓"}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Осталось {dashboard.daysLeft} дн.</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Ежедневные продажи</h2>
          <p className="text-sm text-muted-foreground">Динамика за текущий месяц</p>
        </div>
        {dashboard.dailySales.length > 0 ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboard.dailySales} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                  cursor={{ fill: "hsl(var(--muted)/0.3)" }}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--card))",
                    color: "hsl(var(--card-foreground))",
                  }}
                  labelFormatter={(v) => format(new Date(v + "T12:00:00"), "d MMMM yyyy")}
                />
                <Legend wrapperStyle={{ paddingTop: "16px", fontSize: 13 }} />
                <Bar dataKey="simSold" name="SIM-карты" fill="hsl(237 73% 61%)" radius={[4,4,0,0]} maxBarSize={40} />
                <Bar dataKey="devicesSold" name="Устройства" fill="#10b981" radius={[4,4,0,0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <Calendar className="w-12 h-12 mb-4 opacity-20" />
            <p>Продажи за этот месяц ещё не записаны.</p>
          </div>
        )}
      </div>
    </div>
  );
}
