import { useState, useEffect, useCallback } from "react";

export type ToastType = "success" | "error" | "info";
export interface Toast { id: number; message: string; type: ToastType; }

let _counter = 0;
let _toasts: Toast[] = [];
const _listeners = new Set<(t: Toast[]) => void>();

function notify() {
  _listeners.forEach(l => l([..._toasts]));
}

export function toast(message: string, type: ToastType = "info") {
  const id = ++_counter;
  _toasts = [..._toasts, { id, message, type }];
  notify();
  setTimeout(() => {
    _toasts = _toasts.filter(t => t.id !== id);
    notify();
  }, 4000);
}

export function useToastStore() {
  const [toasts, setToasts] = useState<Toast[]>(_toasts);

  useEffect(() => {
    const l = (next: Toast[]) => setToasts(next);
    _listeners.add(l);
    return () => { _listeners.delete(l); };
  }, []);

  const remove = useCallback((id: number) => {
    _toasts = _toasts.filter(t => t.id !== id);
    notify();
  }, []);

  return { toasts, remove };
}
