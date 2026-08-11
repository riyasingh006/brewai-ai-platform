import { clsx } from "clsx";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export function cn(...parts: (string | false | null | undefined)[]) {
  return twMerge(clsx(parts));
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] disabled:opacity-50 disabled:pointer-events-none select-none",
        variant === "primary" &&
          "bg-gradient-to-br from-[#d89b5c] to-[#a96a2e] text-white shadow-md shadow-[var(--brand)]/30 hover:shadow-[var(--brand)]/50 hover:brightness-110 active:scale-[0.98]",
        variant === "secondary" &&
          "border border-[var(--border)] bg-[var(--panel)]/70 text-[var(--fg)] hover:border-[var(--brand)]/30 hover:bg-[var(--hover)] active:scale-[0.98]",
        variant === "ghost" &&
          "text-[var(--muted)] hover:bg-[var(--hover)]/60 hover:text-[var(--fg)]",
        variant === "danger" &&
          "border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20",
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-9 px-4 text-sm",
        size === "lg" && "h-11 px-5 text-sm",
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
};

export function Input({ label, hint, className, ...rest }: InputProps) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
          {label}
        </span>
      )}
      <input
        className={cn(
          "h-9 w-full rounded-xl border border-[var(--border)] bg-[var(--panel)]/70 px-3 text-sm text-[var(--fg)] placeholder:text-[var(--muted)]/60 transition-all focus:border-[var(--brand)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40",
          className,
        )}
        {...rest}
      />
      {hint && <span className="mt-1 block text-xs text-[var(--muted)]">{hint}</span>}
    </label>
  );
}

export function Textarea({
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-xl border border-[var(--border)] bg-[var(--panel)]/70 px-3 py-2.5 text-sm text-[var(--fg)] placeholder:text-[var(--muted)]/60 transition-all focus:border-[var(--brand)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40",
        className,
      )}
      {...rest}
    />
  );
}

export function Card({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--border)] bg-[var(--panel)]/70 p-4 backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: "default" | "brand" | "green" | "amber" | "red";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        tone === "default" && "bg-[var(--hover)] text-[var(--muted)]",
        tone === "brand" && "bg-[var(--brand)]/15 text-[var(--brand)]",
        tone === "green" && "bg-emerald-500/15 text-emerald-400",
        tone === "amber" && "bg-amber-500/15 text-amber-400",
        tone === "red" && "bg-red-500/15 text-red-400",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className ?? "size-4")}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
      />
    </svg>
  );
}
