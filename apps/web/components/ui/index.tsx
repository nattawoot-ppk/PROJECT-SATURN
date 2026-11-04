"use client";
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from "react";

export function Panel({ children, className = "", title, right }: { children: ReactNode; className?: string; title?: ReactNode; right?: ReactNode }) {
  return (
    <section className={`glass rounded-[18px] p-3 ${className}`}>
      {(title || right) && (
        <header className="mb-2 flex items-center justify-between">
          {title && <div className="label">{title}</div>}
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatTile({ label, value, unit, hint, bars, tone = "neutral", className = "" }: { label: string; value: string; unit?: string; hint?: string; bars?: number[]; tone?: "neutral" | "accent" | "teal" | "danger"; className?: string }) {
  const toneCls = tone === "accent" ? "text-accent" : tone === "teal" ? "text-teal" : tone === "danger" ? "text-danger" : "text-ink";
  const max = bars?.length ? Math.max(...bars, 0.0001) : 1;
  return (
    <div className={`glass-soft rounded-[16px] p-3 ${className}`}>
      <div className="label">{label}</div>
      <div className={`mt-1 flex items-baseline gap-1 ${toneCls}`}>
        <span className="num text-[22px] font-semibold leading-none tracking-tight">{value}</span>
        {unit && <span className="text-[11px] text-ink-3">{unit}</span>}
      </div>
      {bars && (
        <div className="mt-2 flex h-5 items-end gap-[3px]">
          {bars.map((b, i) => <span key={i} className="w-[5px] rounded-sm bg-teal/70" style={{ height: `${Math.max(8, (b / max) * 100)}%` }} />)}
        </div>
      )}
      {hint && <div className="mt-1 text-[11px] text-ink-3">{hint}</div>}
    </div>
  );
}

export function Btn({ children, variant = "ghost", size = "md", className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "teal" | "danger" | "outline"; size?: "sm" | "md" }) {
  const v = {
    primary: "bg-accent text-white hover:bg-accent-2 shadow-[0_8px_24px_rgba(255,90,31,0.35)]",
    teal: "bg-teal text-black hover:brightness-110",
    danger: "bg-danger/85 text-white hover:bg-danger",
    outline: "border border-line-2 text-ink hover:bg-panel-2",
    ghost: "bg-panel-2 text-ink hover:bg-white/15",
  }[variant];
  const s = size === "sm" ? "px-2.5 py-1 text-[11.5px]" : "px-3.5 py-1.5 text-[13px]";
  return <button className={`pill inline-flex items-center justify-center gap-1.5 font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${v} ${s} ${className}`} {...rest}>{children}</button>;
}

export function IconBtn({ children, active, className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return <button className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${active ? "border-accent bg-accent text-white shadow-[0_6px_20px_rgba(255,90,31,0.45)]" : "border-line bg-panel text-ink-2 hover:bg-panel-2 hover:text-ink"} ${className}`} {...rest}>{children}</button>;
}

export function Segmented<T extends string>({ value, options, onChange, className = "" }: { value: T; options: Array<{ id: T; label: ReactNode; badge?: string }>; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={`glass-soft pill inline-flex items-center gap-0.5 p-0.5 ${className}`}>
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} className={`pill relative px-3 py-1 text-[11.5px] font-medium transition ${value === o.id ? "bg-white text-black" : "text-ink-2 hover:text-ink"}`}>
          {o.label}
          {o.badge && <span className="ml-1 rounded-full bg-accent px-1.5 text-[9px] text-white">{o.badge}</span>}
        </button>
      ))}
    </div>
  );
}

export const inputCls = "w-full rounded-[10px] border border-line bg-black/30 px-2.5 py-1.5 text-[13px] text-ink placeholder:text-ink-3 focus:border-accent/70 focus:outline-none";
export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`block space-y-1 ${className}`}><span className="label">{label}</span>{children}</label>;
}
export function Input(props: InputHTMLAttributes<HTMLInputElement>) { return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />; }
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) { return <select {...props} className={`${inputCls} ${props.className ?? ""}`} />; }
export function Num({ label, value, onChange, step = 1, min, placeholder }: { label: string; value: number | undefined; onChange: (v: number | undefined) => void; step?: number; min?: number; placeholder?: string }) {
  return <Field label={label}><Input type="number" step={step} min={min} placeholder={placeholder ?? "—"} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} /></Field>;
}
export function Chip({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: "neutral" | "accent" | "teal" | "danger" | "amber"; className?: string }) {
  const t = { neutral: "bg-panel-2 text-ink-2", accent: "bg-accent/20 text-accent", teal: "bg-teal/15 text-teal", danger: "bg-danger/20 text-danger", amber: "bg-amber/20 text-amber" }[tone];
  return <span className={`pill inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium ${t} ${className}`}>{children}</span>;
}
export function Divider() { return <div className="my-2 h-px bg-line" />; }
