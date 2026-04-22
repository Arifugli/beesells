import { useState, useEffect, useCallback } from "react";
import { getToken, setToken, clearToken, type User } from "@/lib/api";

export interface Session { token: string; user: User; }

// ─── Global session store ─────────────────────────────────────────────────────
let _currentSession: Session | null = null;
const _listeners = new Set<(s: Session | null) => void>();

function readSession(): Session | null {
  const token = getToken();
  const raw = localStorage.getItem("ts_user");
  if (token && raw) {
    try { return { token, user: JSON.parse(raw) }; }
    catch { clearToken(); localStorage.removeItem("ts_user"); }
  }
  return null;
}

_currentSession = readSession();

function notify(newSession: Session | null) {
  _currentSession = newSession;
  _listeners.forEach(l => l(newSession));
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(_currentSession);

  useEffect(() => {
    const listener = (s: Session | null) => setSession(s);
    _listeners.add(listener);
    if (session !== _currentSession) setSession(_currentSession);
    return () => { _listeners.delete(listener); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback((token: string, user: User) => {
    setToken(token);
    localStorage.setItem("ts_user", JSON.stringify(user));
    notify({ token, user });
  }, []);

  const logout = useCallback(() => {
    clearToken();
    localStorage.removeItem("ts_user");
    notify(null);
  }, []);

  return { session, user: session?.user ?? null, isLoaded: true, login, logout };
}
