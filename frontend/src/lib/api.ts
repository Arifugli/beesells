const API_BASE = import.meta.env.VITE_API_URL ?? "";

export function getToken() { return localStorage.getItem("ts_token"); }
export function setToken(t: string) { localStorage.setItem("ts_token", t); }
export function clearToken() { localStorage.removeItem("ts_token"); }

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) {
      clearToken(); localStorage.removeItem("ts_user");
      const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
      if (window.location.pathname !== base + "/") window.location.href = base + "/";
    }
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface User { id: number; name: string; role: "admin" | "manager" | "operator"; email?: string | null; hasPassword?: boolean; createdAt?: string; }
export interface OperatorWithBranch extends User { branchId: number; }
export interface Branch { id: number; name: string; address?: string | null; isActive: boolean; createdAt: string; }
export interface BranchDetail extends Branch { managers: { id: number; name: string }[]; operatorCount: number; }
export interface KpiCategory { id: number; name: string; unit: string; isActive: boolean; }
export interface KpiTarget { id: number; operatorId: number; categoryId: number; month: string; target: number; }
export interface KpiEntry { id: number; operatorId: number; categoryId: number; date: string; value: number; }
export interface KpiStat { category: KpiCategory; target: number; actual: number; percent: number; neededPerDay: number; dailyEntries: KpiEntry[]; }
export interface Tariff { id: number; name: string; price: number; isActive: boolean; }
export interface TariffTarget { id: number; operatorId: number; tariffId: number; month: string; target: number; }
export interface TariffSale { id: number; operatorId: number; tariffId: number; date: string; quantity: number; }
export interface TariffStat { tariff: Tariff; target: number; quantity: number; revenue: number; percent: number; neededPerDay: number; dailySales: TariffSale[]; }
export interface OperatorStats { operator: User; kpis: KpiStat[]; tariffStats: TariffStat[]; totalRevenue: number; avgPercent: number; rank?: number; }
export interface BranchStats { branch: Branch; operators: OperatorStats[]; }
export interface OperatorDashboard { operator: User; branch: Branch | null; month: string; kpis: KpiStat[]; tariffStats: TariffStat[]; totalRevenue: number; daysLeft: number; teamRank: number; teamSize: number; }
export interface ManagerDashboard { month: string; branches: BranchStats[]; categories: KpiCategory[]; tariffs: Tariff[]; }
export interface AuthResponse { token: string; user: User; }

// ─── API ──────────────────────────────────────────────────────────────────────
export const api = {
  auth: {
    login: (login: string, password: string) =>
      request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ login, password }) }),
    users: (role?: string) =>
      request<(User & { hasPassword: boolean })[]>(`/auth/users${role ? `?role=${role}` : ""}`),
    forgotPassword: (login: string) =>
      request<{ message: string }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ login }) }),
    resetPassword: (token: string, password: string) =>
      request<{ message: string }>("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) }),
  },
  admin: {
    branches: () => request<BranchDetail[]>("/admin/branches"),
    createBranch: (data: { name: string; address?: string }) => request<Branch>("/admin/branches", { method: "POST", body: JSON.stringify(data) }),
    updateBranch: (id: number, data: Partial<Branch>) => request<Branch>(`/admin/branches/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteBranch: (id: number) => request<void>(`/admin/branches/${id}`, { method: "DELETE" }),
    assignManager: (branchId: number, managerId: number) => request<void>(`/admin/branches/${branchId}/managers/${managerId}`, { method: "POST" }),
    removeManager: (branchId: number, managerId: number) => request<void>(`/admin/branches/${branchId}/managers/${managerId}`, { method: "DELETE" }),
    managers: () => request<User[]>("/admin/managers"),
    createManager: (data: { name: string; email?: string; password?: string }) => request<User>("/admin/managers", { method: "POST", body: JSON.stringify(data) }),
    updateManager: (id: number, data: { name?: string; email?: string | null; password?: string }) => request<User>(`/admin/managers/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteManager: (id: number) => request<void>(`/admin/managers/${id}`, { method: "DELETE" }),
    kpiCategories: () => request<KpiCategory[]>("/admin/kpi-categories"),
    createCategory: (data: { name: string; unit: string }) => request<KpiCategory>("/admin/kpi-categories", { method: "POST", body: JSON.stringify(data) }),
    updateCategory: (id: number, data: Partial<KpiCategory>) => request<KpiCategory>(`/admin/kpi-categories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteCategory: (id: number) => request<void>(`/admin/kpi-categories/${id}`, { method: "DELETE" }),
    tariffs: () => request<Tariff[]>("/admin/tariffs"),
    createTariff: (data: { name: string; price: number }) => request<Tariff>("/admin/tariffs", { method: "POST", body: JSON.stringify(data) }),
    updateTariff: (id: number, data: Partial<Tariff>) => request<Tariff>(`/admin/tariffs/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteTariff: (id: number) => request<void>(`/admin/tariffs/${id}`, { method: "DELETE" }),
    changePassword: (password: string) => request<{ ok: boolean }>("/admin/password", { method: "PUT", body: JSON.stringify({ password }) }),
  },
  manager: {
    dashboard: (month: string) => request<ManagerDashboard>(`/manager/dashboard?month=${month}`),
    branches: () => request<Branch[]>("/manager/branches"),
    operators: (branchId?: number) => request<OperatorWithBranch[]>(`/manager/operators${branchId ? `?branchId=${branchId}` : ""}`),
    createOperator: (data: { name: string; branchId: number; email?: string; password?: string }) => request<User>("/manager/operators", { method: "POST", body: JSON.stringify(data) }),
    updateOperator: (id: number, data: { name?: string; email?: string | null; password?: string }) => request<User>(`/manager/operators/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteOperator: (id: number) => request<void>(`/manager/operators/${id}`, { method: "DELETE" }),
    kpiCategories: () => request<KpiCategory[]>("/manager/kpi-categories"),
    targets: (operatorId: number, month: string) => request<KpiTarget[]>(`/manager/targets?operatorId=${operatorId}&month=${month}`),
    setTarget: (data: { operatorId: number; categoryId: number; month: string; target: number }) => request<KpiTarget>("/manager/targets", { method: "POST", body: JSON.stringify(data) }),
    tariffs: () => request<Tariff[]>("/manager/tariffs"),
    tariffTargets: (operatorId: number, month: string) => request<TariffTarget[]>(`/manager/tariff-targets?operatorId=${operatorId}&month=${month}`),
    setTariffTarget: (data: { operatorId: number; tariffId: number; month: string; target: number }) => request<TariffTarget>("/manager/tariff-targets", { method: "POST", body: JSON.stringify(data) }),
  },
  operator: {
    dashboard: (month: string) => request<OperatorDashboard>(`/operator/dashboard?month=${month}`),
    logEntry: (data: { categoryId: number; date: string; value: number }) => request<KpiEntry>("/operator/entries", { method: "POST", body: JSON.stringify(data) }),
    logTariffSale: (data: { tariffId: number; date: string; quantity: number }) => request<TariffSale>("/operator/tariff-sales", { method: "POST", body: JSON.stringify(data) }),
  },
  archive: {
    months: () => request<string[]>("/archive/months"),
  },
};
