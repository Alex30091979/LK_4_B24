import React from "react";
import { Link } from "react-router-dom";

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }) {
  const variant = props.variant ?? "primary";
  const cls =
    variant === "primary"
      ? "bg-slate-900 text-white hover:bg-slate-800"
      : "bg-white text-slate-900 border border-slate-200 hover:bg-slate-50";
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition ${cls} ${
        props.disabled ? "opacity-60 cursor-not-allowed" : ""
      } ${props.className ?? ""}`}
    />
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block">
      {label ? <div className="mb-1 text-sm text-slate-600">{label}</div> : null}
      <input
        {...rest}
        className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 ${
          props.className ?? ""
        }`}
      />
    </label>
  );
}

export function Card(props: { title?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {props.title ? (
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="text-sm font-semibold">{props.title}</div>
          {props.right}
        </div>
      ) : null}
      <div className="p-4">{props.children}</div>
    </div>
  );
}

export function NavLinkButton(props: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={props.to}
      className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
    >
      {props.children}
    </Link>
  );
}

export function Badge(props: { children: React.ReactNode; tone?: "green" | "gray" }) {
  const tone = props.tone ?? "gray";
  const cls = tone === "green" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{props.children}</span>;
}



