import { useState } from "react";

export function truncMid(s?: string, head = 8, tail = 6): string {
  if (!s) return "—";
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export function Card({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded border border-white/10 bg-surface-2/60 px-3.5 py-3 ${className}`}
    >
      <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-dim">
        {label}
      </div>
      <div className="text-[13px] text-ink">{children}</div>
    </div>
  );
}

export function CopyButton({ value }: { value?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="ml-1.5 rounded-sm border border-white/10 px-1.5 py-0.5 text-[10px] text-ink-soft transition hover:border-eigen-accent/60 hover:text-eigen-accent-soft"
      title="Copy"
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}

export function Panel({
  title,
  desc,
  right,
  children,
}: {
  title: string;
  desc?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded border border-white/10 bg-surface-1/70 p-4 backdrop-blur-sm sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink">
            {title}
          </h2>
          {desc && <p className="mt-1 text-[12px] text-ink-dim">{desc}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function VerdictChip({ verdict }: { verdict: "ALLOW" | "DENY" }) {
  const allow = verdict === "ALLOW";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        allow
          ? "bg-pass/15 text-pass ring-1 ring-pass/30"
          : "bg-deny/15 text-deny ring-1 ring-deny/30"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${allow ? "bg-pass" : "bg-deny"}`}
      />
      {verdict}
    </span>
  );
}
