import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button, NavLinkButton } from "../components/ui";
import { getMeCached, logout } from "../lib/auth";

export function AppLayout() {
  const me = getMeCached();
  const nav = useNavigate();
  const loc = useLocation();

  const isAdmin = me?.role === "admin";
  const isAdminArea = loc.pathname.startsWith("/admin");

  const topLinks = isAdmin
    ? [
        { to: "/admin", label: "Админка" },
        { to: "/dashboard", label: "Клиентский вид" }
      ]
    : [{ to: "/dashboard", label: "Дашборд" }];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="text-sm font-bold">LK</div>
            <div className="hidden sm:flex items-center gap-1">
              {topLinks.map((l) => (
                <NavLinkButton key={l.to} to={l.to}>
                  {l.label}
                </NavLinkButton>
              ))}
              {isAdmin ? (
                <NavLinkButton to={isAdminArea ? "/dashboard" : "/admin"}>{isAdminArea ? "Клиент" : "Админ"}</NavLinkButton>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:block text-xs text-slate-500">
              {me?.role} • BitrixID {me?.bitrixContactId}
            </div>
            <Button
              variant="secondary"
              onClick={async () => {
                await logout();
                nav("/login");
              }}
            >
              Выйти
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}


