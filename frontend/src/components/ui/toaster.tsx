import { useState, useEffect, createContext, useContext, useCallback, ReactNode } from "react";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";

type ToastType = "success" | "error" | "info";
interface Toast { id: number; message: string; type: ToastType; }

const ToastContext = createContext<{ toast: (msg: string, type?: ToastType) => void }>({
  toast: () => {},
});

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++counter;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const remove = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm animate-fade-in-up ${
              t.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : t.type === "error" ? "bg-red-50 border-red-200 text-red-800"
              : "bg-card border-border text-foreground"
            }`}
          >
            {t.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              : t.type === "error" ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              : <Info className="w-4 h-4 shrink-0 mt-0.5" />}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => remove(t.id)} className="shrink-0 opacity-60 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function Toaster() { return null; } // placeholder, ToastProvider handles rendering

export function useToast() {
  return useContext(ToastContext);
}
