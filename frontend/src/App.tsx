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

// ─── GitHub Pages SPA redirect ────────────────────────────────────────────────
// 404.html redirects to /?/path → we need to convert it back to /path
(function resolveGHPagesPath() {
  const loc = window.location;
  if (loc.search.startsWith("?/")) {
    const base = import.meta.env.BASE_URL || "/";
    const basePath = base.replace(/\/$/, "");
    const rest = loc.search.slice(2).replace(/&/g, "?");
    const newPath = basePath + "/" + rest + loc.hash;
    window.history.replaceState(null, "", newPath);
  }
})();

function homeFor(role: string | undefined) {
  if (role === "admin") return "/admin/branches";
  if (role === "manager") return "/manager";
  if (role === "operator") return "/operator";
  return "/";
}

function Protected({ component: C, roles }: { component: React.ComponentType; roles: string[] }) {
  const { user } = useAuth();
  if (!user) return <Redirect to="/" />;
  if (!roles.includes(user.role)) return <Redirect to={homeFor(user.role)} />;
  return <AppLayout><C /></AppLayout>;
}

function Router() {
  const { user } = useAuth();
  const home = homeFor(user?.role);

  return (
    <Switch>
      <Route path="/">
        {user ? <Redirect to={home} /> : <Login />}
      </Route>

      <Route path="/operator"><Protected component={OperatorDashboard} roles={["operator"]} /></Route>
      <Route path="/operator/log"><Protected component={OperatorLog} roles={["operator"]} /></Route>

      <Route path="/manager"><Protected component={ManagerDashboard} roles={["manager"]} /></Route>
      <Route path="/manager/operators"><Protected component={ManagerOperators} roles={["manager"]} /></Route>

      <Route path="/admin/branches"><Protected component={AdminBranches} roles={["admin"]} /></Route>
      <Route path="/admin/managers"><Protected component={AdminManagers} roles={["admin"]} /></Route>
      <Route path="/admin/kpi"><Protected component={AdminKpi} roles={["admin"]} /></Route>

      <Route>
        <Redirect to={user ? home : "/"} />
      </Route>
    </Switch>
  );
}

export default function App() {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  return (
    <>
      <WouterRouter base={base}>
        <Router />
      </WouterRouter>
      <Toaster />
    </>
  );
}
