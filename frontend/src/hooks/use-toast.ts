import { useState, useCallback } from "react";

type ToastType = "success" | "error" | "info";
interface Toast { id: number; message: string; type: ToastType; }

let _counter = 0;
let _setToasts: React.Dispatch<React.SetStateAction<Toast[]>> | null = null;

export function useToastStore() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  _setToasts = setToasts;
  const remove = useCallback((id: number) => setToasts(p => p.filter(t => t.id !== id)), []);
  return { toasts, remove };
}

export function toast(message: string, type: ToastType = "info") {
  if (!_setToasts) return;
  const id = ++_counter;
  _setToasts(p => [...p, { id, message, type }]);
  setTimeout(() => _setToasts?.(p => p.filter(t => t.id !== id)), 4000);
}
