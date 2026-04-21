import { useState, useEffect } from "react";
import { getToken, setToken, clearToken, type User } from "@/lib/api";

export interface Session { token: string; user: User; }

export function useAuth() {
  const [session, setSession] = useState<Session | null>(() => {
    const token = getToken();
    const raw = localStorage.getItem("ts_user");
    if (token && raw) {
      try { return { token, user: JSON.parse(raw) }; } catch { clearToken(); }
    }
    return null;
  });
  const [isLoaded, setIsLoaded] = useState(true);

  const login = (token: string, user: User) => {
    setToken(token);
    localStorage.setItem("ts_user", JSON.stringify(user));
    setSession({ token, user });
  };

  const logout = () => {
    clearToken();
    localStorage.removeItem("ts_user");
    setSession(null);
  };

  return { session, user: session?.user ?? null, isLoaded, login, logout };
}
