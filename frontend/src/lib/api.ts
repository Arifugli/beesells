// Centralised API base URL — set VITE_API_URL in your environment
const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---------- Types ----------
export interface Operator {
  id: number;
  name: string;
  role: "operator" | "manager";
  simTarget: number;
  deviceTarget: number;
  createdAt: string;
}

export interface SalesEntry {
  id: number;
  operatorId: number;
  date: string;
  simSold: number;
  devicesSold: number;
  createdAt: string;
}

export interface OperatorDashboard {
  operator: Operator;
  month: string;
  simSold: number;
  devicesSold: number;
  simTarget: number;
  deviceTarget: number;
  simPercent: number;
  devicePercent: number;
  daysLeft: number;
  simNeededPerDay: number;
  deviceNeededPerDay: number;
  teamRank: number;
  totalOperators: number;
  dailySales: SalesEntry[];
}

export interface OperatorStats {
  operator: Operator;
  simSold: number;
  devicesSold: number;
  simPercent: number;
  devicePercent: number;
  rank: number;
}

export interface ManagerDashboard {
  month: string;
  totalSim: number;
  totalDevices: number;
  totalSimTarget: number;
  totalDeviceTarget: number;
  operatorsCount: number;
  behindCount: number;
  operators: OperatorStats[];
}

export interface DailyActivity {
  date: string;
  simSold: number;
  devicesSold: number;
  cumSim: number;
  cumDev: number;
}

// ---------- Operators ----------
export const api = {
  operators: {
    list: () => request<Operator[]>("/operators"),
    get: (id: number) => request<Operator>(`/operators/${id}`),
    create: (data: Omit<Operator, "id" | "createdAt">) =>
      request<Operator>("/operators", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Omit<Operator, "id" | "createdAt">>) =>
      request<Operator>(`/operators/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/operators/${id}`, { method: "DELETE" }),
  },
  sales: {
    create: (data: { operatorId: number; date: string; simSold: number; devicesSold: number }) =>
      request<SalesEntry>("/sales", { method: "POST", body: JSON.stringify(data) }),
    list: (params?: { operatorId?: number; month?: string }) => {
      const q = new URLSearchParams();
      if (params?.operatorId) q.set("operatorId", String(params.operatorId));
      if (params?.month) q.set("month", params.month);
      return request<SalesEntry[]>(`/sales?${q}`);
    },
  },
  dashboard: {
    operator: (operatorId: number, month: string) =>
      request<OperatorDashboard>(`/dashboard/operator/${operatorId}?month=${month}`),
    manager: (month: string) =>
      request<ManagerDashboard>(`/dashboard/manager?month=${month}`),
    teamActivity: (month: string) =>
      request<DailyActivity[]>(`/dashboard/team-activity?month=${month}`),
  },
};
