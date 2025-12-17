import React, { useEffect, useState } from "react";
import { createBrowserRouter, createHashRouter, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { bootstrapSession, getMeCached } from "./lib/auth";
import { isStandaloneMode } from "./lib/standalone";
import { LoginPage } from "./pages/LoginPage";
import { MfaPage } from "./pages/MfaPage";
import { AppLayout } from "./layouts/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { RecommendationsPage } from "./pages/RecommendationsPage";
import { ContractPage } from "./pages/ContractPage";
import { AdminHomePage } from "./pages/admin/AdminHomePage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { AdminTreePage } from "./pages/admin/AdminTreePage";
import { AdminAuditPage } from "./pages/admin/AdminAuditPage";

function BootGate(props: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    bootstrapSession()
      .then((me) => {
        setReady(true);
        if (!me && loc.pathname !== "/login") nav("/login", { replace: true });
      })
      .catch(() => {
        setReady(true);
        if (loc.pathname !== "/login") nav("/login", { replace: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return (
      <div className="mx-auto max-w-md p-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Загрузка…</div>
      </div>
    );
  }

  return <>{props.children}</>;
}

function RequireAuth() {
  const me = getMeCached();
  const loc = useLocation();
  if (!me) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <Outlet />;
}

function RequireAdmin() {
  const me = getMeCached();
  const loc = useLocation();
  if (!me) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (me.role !== "admin") return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

const routes = [
  {
    path: "/",
    element: (
      <BootGate>
        <Outlet />
      </BootGate>
    ),
    children: [
      { path: "login", element: <LoginPage /> },
      { path: "mfa", element: <MfaPage /> },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <Navigate to="/dashboard" replace /> },
              { path: "dashboard", element: <DashboardPage /> },
              { path: "recommendations", element: <RecommendationsPage /> },
              { path: "contracts/:id", element: <ContractPage /> },
              {
                path: "admin",
                element: <RequireAdmin />,
                children: [
                  { index: true, element: <AdminHomePage /> },
                  { path: "users", element: <AdminUsersPage /> },
                  { path: "tree", element: <AdminTreePage /> },
                  { path: "audit", element: <AdminAuditPage /> }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
];

export const router = isStandaloneMode() ? createHashRouter(routes as any) : createBrowserRouter(routes as any);


