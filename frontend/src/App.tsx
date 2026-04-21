import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Toaster } from "@/components/ui/Toaster";

import Login from "@/pages/Login";
import OperatorDashboard from "@/pages/operator/Dashboard";
import OperatorLog from "@/pages/operator/Log";
import ManagerDashboard from "@/pages/manager/Dashboard";
import ManagerOperators from "@/pages/manager/Operators";
import AdminBranches from "@/pages/admin/Branches";
import AdminManagers from "@/pages/admin/Managers";
import AdminKpi from "@/pages/admin/KpiCategories";

// Fix GitHub Pages SPA redirect
function resolveGHPagesPath() {
  const search = window.location.search;
  if (search.startsWith("?/")) {
    window.history.replaceState(null, "",
      window.location.pathname.replace(/\/$/, "") + search.slice(1) + window.location.hash
    );
  }
}
resolveGHPagesPath();

function Protected({ component: C, roles }: { component: React.ComponentType; roles: string[] }) {
  const { user, isLoaded } = useAuth();
  if (!isLoaded) return <div className="min-h-screen flex items-center justify-center text-gray-400">Загрузка...</div>;
  if (!user) return <Redirect to="/" />;
  if (!roles.includes(user.role)) {
    const home = user.role === "admin" ? "/admin/branches" : user.role === "manager" ? "/manager" : "/operator";
    return <Redirect to={home} />;
  }
  return <AppLayout><C /></AppLayout>;
}

function Router() {
  const { user, isLoaded } = useAuth();
  if (!isLoaded) return <div className="min-h-screen flex items-center justify-center text-gray-400">Загрузка...</div>;

  const home = !user ? "/" : user.role === "admin" ? "/admin/branches" : user.role === "manager" ? "/manager" : "/operator";

  return (
    <Switch>
      <Route path="/">
        {user ? <Redirect to={home} /> : <Login />}
      </Route>

      {/* Operator */}
      <Route path="/operator"><Protected component={OperatorDashboard} roles={["operator"]} /></Route>
      <Route path="/operator/log"><Protected component={OperatorLog} roles={["operator"]} /></Route>

      {/* Manager */}
      <Route path="/manager"><Protected component={ManagerDashboard} roles={["manager"]} /></Route>
      <Route path="/manager/operators"><Protected component={ManagerOperators} roles={["manager"]} /></Route>

      {/* Admin */}
      <Route path="/admin/branches"><Protected component={AdminBranches} roles={["admin"]} /></Route>
      <Route path="/admin/managers"><Protected component={AdminManagers} roles={["admin"]} /></Route>
      <Route path="/admin/kpi"><Protected component={AdminKpi} roles={["admin"]} /></Route>

      <Route>
        {user ? <Redirect to={home} /> : <Redirect to="/" />}
      </Route>
    </Switch>
  );
}

export default function App() {
  const base = (import.meta.env.VITE_BASE_URL || "/").replace(/\/$/, "");
  return (
    <>
      <WouterRouter base={base}>
        <Router />
      </WouterRouter>
      <Toaster />
    </>
  );
}
