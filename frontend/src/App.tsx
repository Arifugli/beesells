import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { ToastProvider } from "@/components/ui/toaster";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout/app-layout";

import Login from "@/pages/login";
import OperatorDashboard from "@/pages/operator-dashboard";
import OperatorLog from "@/pages/operator-log";
import ManagerDashboard from "@/pages/manager-dashboard";
import ManagerOperators from "@/pages/manager-operators";
import NotFound from "@/pages/not-found";

function ProtectedRoute({
  component: Component,
  allowedRole,
}: {
  component: React.ComponentType;
  allowedRole?: "operator" | "manager";
}) {
  const { user, isLoaded } = useAuth();
  if (!isLoaded)
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Загрузка...
      </div>
    );
  if (!user) return <Redirect to="/" />;
  if (allowedRole && user.role !== allowedRole) {
    return <Redirect to={user.role === "manager" ? "/manager" : "/operator"} />;
  }
  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function Router() {
  const { user, isLoaded } = useAuth();
  if (!isLoaded)
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Загрузка...
      </div>
    );
  return (
    <Switch>
      <Route path="/">
        {user ? (
          <Redirect to={user.role === "manager" ? "/manager" : "/operator"} />
        ) : (
          <Login />
        )}
      </Route>
      <Route path="/operator">
        <ProtectedRoute component={OperatorDashboard} allowedRole="operator" />
      </Route>
      <Route path="/operator/log">
        <ProtectedRoute component={OperatorLog} allowedRole="operator" />
      </Route>
      <Route path="/manager">
        <ProtectedRoute component={ManagerDashboard} allowedRole="manager" />
      </Route>
      <Route path="/manager/operators">
        <ProtectedRoute component={ManagerOperators} allowedRole="manager" />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

// GitHub Pages SPA: redirect from ?/path to /path
function resolveGHPagesPath() {
  const search = window.location.search;
  if (search.startsWith("?/")) {
    const path = search.slice(1) + window.location.hash;
    window.history.replaceState(null, "", path);
  }
}
resolveGHPagesPath();

export default function App() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <ToastProvider>
      <WouterRouter base={base}>
        <Router />
      </WouterRouter>
    </ToastProvider>
  );
}
