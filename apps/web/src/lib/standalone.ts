export function isStandaloneMode() {
  try {
    // file:// open OR explicit standalone build mode
    return window.location.protocol === "file:" || (import.meta as any).env?.MODE === "standalone";
  } catch {
    return false;
  }
}

type DemoRole = "client" | "admin";

const LS_ROLE = "lk.demo.role";
const LS_AUTH = "lk.demo.authed";

export function demoGetRole(): DemoRole {
  const r = localStorage.getItem(LS_ROLE);
  return r === "admin" ? "admin" : "client";
}

export function demoSetRole(role: DemoRole) {
  localStorage.setItem(LS_ROLE, role);
}

export function demoIsAuthed() {
  return localStorage.getItem(LS_AUTH) === "1";
}

export function demoSetAuthed(v: boolean) {
  localStorage.setItem(LS_AUTH, v ? "1" : "0");
}


