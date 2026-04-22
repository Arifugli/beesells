import { useToastStore } from "@/hooks/use-toast";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export function Toaster() {
  const { toasts, remove } = useToastStore();
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map(t => (
        <div key={t.id} className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm animate-in ${
          t.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800"
          : t.type === "error" ? "bg-red-50 border-red-200 text-red-800"
          : "bg-white border-gray-200 text-gray-800"
        }`}>
          {t.type === "success" ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
           : t.type === "error" ? <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
           : <Info className="w-4 h-4 mt-0.5 shrink-0" />}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => remove(t.id)} className="shrink-0 opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
