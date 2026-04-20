import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { CreditCard, Smartphone, Save, Loader2, CheckCircle2 } from "lucide-react";

export default function OperatorLog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [simSold, setSimSold] = useState("");
  const [devicesSold, setDevicesSold] = useState("");
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const mutation = useMutation({
    mutationFn: api.sales.create,
    onSuccess: () => {
      setSuccess(true);
      setSimSold("");
      setDevicesSold("");
      setErrorMsg("");
      setTimeout(() => setSuccess(false), 3000);

      const month = date.slice(0, 7);
      queryClient.invalidateQueries({ queryKey: ["dashboard", "operator", user?.id, month] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "team-activity", month] });
    },
    onError: (err: Error) => {
      setErrorMsg(err.message || "Произошла ошибка");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const sim = parseInt(simSold || "0", 10);
    const dev = parseInt(devicesSold || "0", 10);

    if (sim < 0 || dev < 0) { setErrorMsg("Значения не могут быть отрицательными"); return; }
    if (sim === 0 && dev === 0) { setErrorMsg("Введите хотя бы одну продажу"); return; }

    setErrorMsg("");
    mutation.mutate({ operatorId: user.id, date, simSold: sim, devicesSold: dev });
  };

  const todayStr = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Записать продажи</h1>
        <p className="text-muted-foreground mt-1">Зафиксируйте результаты за день.</p>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-md p-6">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Дата</label>
            <input
              type="date"
              value={date}
              max={todayStr}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* SIM + Devices */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <div className="bg-primary/10 p-1.5 rounded-md">
                  <CreditCard className="w-4 h-4 text-primary" />
                </div>
                SIM-карты
              </label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={simSold}
                onChange={(e) => setSimSold(e.target.value)}
                className="w-full h-12 px-3 rounded-md border border-input bg-background text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <div className="bg-emerald-500/10 p-1.5 rounded-md">
                  <Smartphone className="w-4 h-4 text-emerald-500" />
                </div>
                Устройства
              </label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={devicesSold}
                onChange={(e) => setDevicesSold(e.target.value)}
                className="w-full h-12 px-3 rounded-md border border-input bg-background text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Preview */}
          {(simSold || devicesSold) && (
            <div className="bg-secondary/50 rounded-lg p-4 text-sm space-y-1">
              <p className="font-medium text-muted-foreground">Предпросмотр записи</p>
              <p>
                <span className="font-semibold">{format(new Date(date + "T12:00:00"), "d MMMM yyyy", { locale: ru })}</span>
                {" — "}
                {parseInt(simSold || "0")} SIM, {parseInt(devicesSold || "0")} устройств
              </p>
            </div>
          )}

          {errorMsg && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {errorMsg}
            </p>
          )}

          {success && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-md">
              <CheckCircle2 className="w-4 h-4" />
              Продажи успешно записаны!
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full h-11 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold shadow-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {mutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Сохраняем...</>
              ) : (
                <><Save className="w-4 h-4" /> Сохранить запись</>
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <p className="font-medium mb-1">💡 Подсказка</p>
        <p>Если за этот день уже есть запись, она будет обновлена. Можно вводить данные несколько раз в течение дня.</p>
      </div>
    </div>
  );
}
