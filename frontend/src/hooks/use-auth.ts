import { useState, useEffect } from "react";

export type UserSession = {
  id: number;
  role: "operator" | "manager";
  name: string;
};

const SESSION_KEY = "telecom_session";

export function useAuth() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) setSession(JSON.parse(raw));
    } catch {
      // ignore
    }
    setIsLoaded(true);
  }, []);

  const login = (user: UserSession) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    setSession(user);
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  };

  return { user: session, isLoaded, login, logout };
}
