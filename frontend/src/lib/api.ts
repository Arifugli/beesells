const API_BASE = import.meta.env.VITE_API_URL ?? "";

// ─── Token storage ────────────────────────────────────────────────────────────
export function getToken() { return localStorage.getItem("ts_token"); }
export function setToken(t: string) { localStorage.setItem("ts_token", t); }
export function clearToken() { localStorage.removeItem("ts_token"); }

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) {
      // auto-logout on expired/invalid token
      clearToken();
      localStorage.removeItem("ts_user");
      if (window.location.pathname !== "/") window.location.reload();
    }
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface User { id: number; name: string; role: "admin" | "manager" | "operator"; createdAt?: string; }
export interface OperatorWithBranch extends User { branchId: number; }
export interface Branch { id: number; name: string; address?: string | null; isActive: boolean; createdAt: string; }
export interface BranchDetail extends Branch { managers: { id: number; name: string }[]; operatorCount: number; }
export interface KpiCategory { id: number; name: string; unit: string; isActive: boolean; createdAt?: string; }
export interface KpiTarget { id: number; operatorId: number; categoryId: number; month: string; target: number; }
export interface KpiEntry { id: number; operatorId: number; categoryId: number; date: string; value: number; }
export interface KpiStat { category: KpiCategory; target: number; actual: number; percent: number; neededPerDay: number; dailyEntries: KpiEntry[]; }
export interface OperatorStats { operator: User; kpis: KpiStat[]; avgPercent: number; rank?: number; }
export interface BranchStats { branch: Branch; operators: OperatorStats[]; }
export interface OperatorDashboard { operator: User; branch: Branch | null; month: string; kpis: KpiStat[]; daysLeft: number; teamRank: number; teamSize: number; }
export interface ManagerDashboard { month: string; branches: BranchStats[]; categories: KpiCategory[]; }
export interface AuthResponse { token: string; user: User; }

// ─── API ──────────────────────────────────────────────────────────────────────
export const api = {
  auth: {
    loginAdmin: (password: string) =>
      request<AuthResponse>("/auth/login/admin", { method: "POST", body: JSON.stringify({ password }) }),
    loginSelect: (userId: number) =>
      request<AuthResponse>("/auth/login/select", { method: "POST", body: JSON.stringify({ userId }) }),
    users: (role?: string) =>
      request<User[]>(`/auth/users${role ? `?role=${role}` : ""}`),
  },
  admin: {
    branches: () => request<BranchDetail[]>("/admin/branches"),
    createBranch: (data: { name: string; address?: string }) =>
      request<Branch>("/admin/branches", { method: "POST", body: JSON.stringify(data) }),
    updateBranch: (id: number, data: Partial<Branch>) =>
      request<Branch>(`/admin/branches/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteBranch: (id: number) =>
      request<void>(`/admin/branches/${id}`, { method: "DELETE" }),
    assignManager: (branchId: number, managerId: number) =>
      request<void>(`/admin/branches/${branchId}/managers/${managerId}`, { method: "POST" }),
    removeManager: (branchId: number, managerId: number) =>
      request<void>(`/admin/branches/${branchId}/managers/${managerId}`, { method: "DELETE" }),
    managers: () => request<User[]>("/admin/managers"),
    createManager: (name: string) =>
      request<User>("/admin/managers", { method: "POST", body: JSON.stringify({ name }) }),
    updateManager: (id: number, name: string) =>
      request<User>(`/admin/managers/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),
    deleteManager: (id: number) =>
      request<void>(`/admin/managers/${id}`, { method: "DELETE" }),
    kpiCategories: () => request<KpiCategory[]>("/admin/kpi-categories"),
    createCategory: (data: { name: string; unit: string }) =>
      request<KpiCategory>("/admin/kpi-categories", { method: "POST", body: JSON.stringify(data) }),
    updateCategory: (id: number, data: Partial<KpiCategory>) =>
      request<KpiCategory>(`/admin/kpi-categories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteCategory: (id: number) =>
      request<void>(`/admin/kpi-categories/${id}`, { method: "DELETE" }),
    changePassword: (password: string) =>
      request<{ ok: boolean }>("/admin/password", { method: "PUT", body: JSON.stringify({ password }) }),
  },
  manager: {
    dashboard: (month: string) => request<ManagerDashboard>(`/manager/dashboard?month=${month}`),
    branches: () => request<Branch[]>("/manager/branches"),
    operators: (branchId?: number) =>
      request<OperatorWithBranch[]>(`/manager/operators${branchId ? `?branchId=${branchId}` : ""}`),
    createOperator: (name: string, branchId: number) =>
      request<User>("/manager/operators", { method: "POST", body: JSON.stringify({ name, branchId }) }),
    updateOperator: (id: number, name: string) =>
      request<User>(`/manager/operators/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),
    deleteOperator: (id: number) =>
      request<void>(`/manager/operators/${id}`, { method: "DELETE" }),
    kpiCategories: () => request<KpiCategory[]>("/manager/kpi-categories"),
    targets: (operatorId: number, month: string) =>
      request<KpiTarget[]>(`/manager/targets?operatorId=${operatorId}&month=${month}`),
    setTarget: (data: { operatorId: number; categoryId: number; month: string; target: number }) =>
      request<KpiTarget>("/manager/targets", { method: "POST", body: JSON.stringify(data) }),
  },
  operator: {
    dashboard: (month: string) => request<OperatorDashboard>(`/operator/dashboard?month=${month}`),
    logEntry: (data: { categoryId: number; date: string; value: number }) =>
      request<KpiEntry>("/operator/entries", { method: "POST", body: JSON.stringify(data) }),
  },
};
