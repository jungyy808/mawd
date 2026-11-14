"use client";
// 행사·광고 화면 공통 UI (Figma 와이어프레임 톤: 흰 배경, 회색 테두리, 검정 버튼)
import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ crumb, title, desc, action }: { crumb: string; title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-semibold tracking-wide text-neutral-500">{crumb}</p>
        <h1 className="mt-1 text-2xl font-bold text-neutral-900">{title}</h1>
        {desc && <p className="mt-1 text-sm text-neutral-500">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ title, right, children, className = "" }: { title?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-neutral-200 bg-white p-5 ${className}`}>
      {(title || right) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold text-neutral-900">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

type BtnProps = { children: ReactNode; onClick?: () => void; href?: string; variant?: "primary" | "secondary" | "ghost"; disabled?: boolean; type?: "button" | "submit"; className?: string };
export function Button({ children, onClick, href, variant = "primary", disabled, type = "button", className = "" }: BtnProps) {
  const base = "inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40";
  const v = {
    primary: "bg-[#6d53f1] text-white hover:bg-[#5b42e0]",
    secondary: "border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50",
    ghost: "text-neutral-600 hover:bg-neutral-100",
  }[variant];
  if (href) return <Link href={href} className={`${base} ${v} ${className}`}>{children}</Link>;
  return <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${v} ${className}`}>{children}</button>;
}

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: "gray" | "green" | "amber" | "red" | "blue" }) {
  const t = {
    gray: "bg-neutral-100 text-neutral-600",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    blue: "bg-[#6d53f1] text-white",
  }[tone];
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${t}`}>{children}</span>;
}

export function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-700">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#6d53f1] focus:outline-none";

export function Spinner({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-neutral-600">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#6d53f1]/20 border-t-[#6d53f1]" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {message}
      {onRetry && (
        <button onClick={onRetry} className="ml-3 underline">
          다시 시도
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">{children}</div>;
}
